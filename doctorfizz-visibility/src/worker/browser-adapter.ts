import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { ProviderResult } from "../lib/types";
import { browserTargets } from "./browser.config";
// Owner must review provider terms before enabling Tier C in production.
// Public, logged-out sessions only. No stealth, proxies, CAPTCHA solving or persisted cookies.
export async function runBrowser(
  id: string,
  input: { prompt: string; signal: AbortSignal },
): Promise<ProviderResult> {
  const start = Date.now();
  if (
    process.env.TIER_C_ENABLED !== "true" ||
    process.env.TIER_C_TERMS_REVIEWED !== "true"
  )
    return {
      status: "blocked",
      webSearchUsed: false,
      latencyMs: 0,
      errorReason: "Experimental browser provider is disabled.",
    };
  const target = browserTargets[id as keyof typeof browserTargets];
  if (!target)
    return {
      status: "error",
      webSearchUsed: false,
      latencyMs: 0,
      errorReason: "Browser target is not configured.",
    };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const abort = () => {
    void browser.close();
  };
  input.signal.addEventListener("abort", abort, { once: true });
  const blocked = async () => {
    if (
      await page
        .getByText(
          /verify you are human|unusual traffic|captcha|sign in to continue|accept all cookies/i,
        )
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await mkdir("internal-debug", { recursive: true });
      await page
        .screenshot({
          path: "internal-debug/" + id + "-" + randomUUID() + ".png",
        })
        .catch(() => {});
      return true;
    }
    return false;
  };
  try {
    await page.goto(target.url, { waitUntil: "domcontentloaded" });
    if (await blocked())
      return {
        status: "blocked",
        webSearchUsed: false,
        latencyMs: Date.now() - start,
        errorReason: "Login, consent or verification wall detected.",
      };
    const box = page.getByRole("textbox", { name: target.inputName }).first();
    await box.fill(input.prompt);
    await box.press("Enter");
    let previous = "",
      stable = 0;
    while (!input.signal.aborted) {
      if (await blocked())
        return {
          status: "blocked",
          webSearchUsed: false,
          latencyMs: Date.now() - start,
          errorReason: "Provider blocked this public session.",
        };
      const rate = await page
        .getByText(/too many requests|rate limit|try again later/i)
        .first()
        .isVisible()
        .catch(() => false);
      if (rate)
        return {
          status: "rate_limited",
          webSearchUsed: false,
          latencyMs: Date.now() - start,
          errorReason: "Provider rate-limited this session.",
        };
      const answer = page
        .getByTestId(target.answerTestId)
        .or(page.getByRole("article"))
        .last();
      const text = await answer.innerText().catch(() => "");
      const generating = await page
        .getByRole("button", { name: target.stopName })
        .isVisible()
        .catch(() => false);
      if (text && text === previous && !generating) stable++;
      else stable = 0;
      previous = text;
      if (stable >= 3) {
        const urls = await answer
          .locator("a[href]")
          .evaluateAll((nodes) =>
            nodes.map((n) => (n as HTMLAnchorElement).href),
          );
        const citations = urls.flatMap((url) => {
          try {
            const u = new URL(url);
            return u.protocol === "https:" &&
              u.hostname !== new URL(target.url).hostname
              ? [{ url, domain: u.hostname }]
              : [];
          } catch {
            return [];
          }
        });
        return {
          status: "ok",
          answerText: text,
          citations,
          webSearchUsed: false,
          latencyMs: Date.now() - start,
        };
      }
      await page.waitForTimeout(1000);
    }
    return {
      status: "timeout",
      webSearchUsed: false,
      latencyMs: Date.now() - start,
      errorReason: "Browser provider exceeded its deadline.",
    };
  } catch {
    return {
      status: input.signal.aborted ? "timeout" : "error",
      webSearchUsed: false,
      latencyMs: Date.now() - start,
      errorReason: input.signal.aborted
        ? "Browser provider exceeded its deadline."
        : "Public provider UI could not be read; check the experimental locators.",
    };
  } finally {
    input.signal.removeEventListener("abort", abort);
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
