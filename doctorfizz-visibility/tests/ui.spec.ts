import { test, expect } from "@playwright/test";
test("customer flow with test-only transport fixtures", async ({ page }) => {
  const profile = {
    category: "accounting software",
    subCategory: "",
    primaryOffering: "bookkeeping",
    targetAudience: "small businesses",
    isLocalBusiness: false,
    location: "",
    language: "English",
    confidence: 0.9,
  };
  const prompts = Array.from({ length: 5 }, (_, i) => ({
    id: "prompt" + i,
    type: ["Best options", "Solve a problem", "Compare", "Audience", "Trust"][
      i
    ],
    text: `Which accounting software would you recommend for small business use case ${i + 1}?`,
  }));
  let remaining = 5;
  let started = false;
  await page.route("**/api/usage", (r) =>
    r.fulfill({ json: { attemptsLeft: remaining } }),
  );
  await page.route("**/api/site/analyze", (r) =>
    r.fulfill({
      json: {
        profileId: "profile",
        profile,
        brand: { name: "Acme", aliases: [], domain: "acme.com" },
        prompts,
      },
    }),
  );
  await page.route("**/api/checks", (r) => {
    started = true;
    remaining = 0;
    return r.fulfill({ json: { checkId: "test-check", attemptsLeft: 0 } });
  });
  await page.route("**/api/checks/test-check", (r) =>
    r.fulfill({
      json: {
        id: "test-check",
        brand: { name: "Acme", aliases: [], domain: "acme.com" },
        prompt_text: prompts[0].text,
        status: "completed",
        created_at: new Date().toISOString(),
        refunded: false,
        runs: [
          {
            id: "run",
            provider_id: "openai",
            status: "ok",
            answer_text: "1. Acme: useful software",
            citations: [],
            model_reported: "test-fixture",
            web_search_used: false,
            from_cache: false,
            created_at: new Date().toISOString(),
            repeat_index: 0,
            analysis: {
              mentioned: true,
              score: 82,
              position: 1,
              totalEntities: 1,
              cited: false,
              sentiment: "neutral",
              snippet: "1. Acme: useful software",
              competitors: [],
            },
          },
        ],
      },
    }),
  );
  await page.route("**/api/checks/test-check/stream", (r) =>
    r.fulfill({ contentType: "text/event-stream", body: "" }),
  );
  await page.route("**/challenges.cloudflare.com/**", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: 'window.turnstile={render:(el,o)=>{o.callback("fixture-token");return "id"},remove:()=>{},reset:()=>{}};',
    }),
  );
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "ready");
  await page.waitForFunction(
    () =>
      getComputedStyle(document.getElementById("tool-card")!).opacity === "1",
  );
  await page.screenshot({ path: "docs/preview-desktop.png", fullPage: false });
  await page
    .getByLabel("Website URL", { exact: true })
    .fill("https://acme.com");
  await page.getByLabel("Brand / company name").fill("Acme");
  await page.getByRole("button", { name: "Analyse my brand" }).click();
  await expect(page.getByRole("radio")).toHaveCount(5);
  await expect(
    page.getByRole("button", { name: "ChatGPT", exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Check my visibility" }).click();
  await expect(page.getByText("Visible #1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View response" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("test-fixture", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Get a full visibility audit" }),
  ).toBeVisible();
  expect(started).toBe(true);
});
test("mobile layout has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "ready");
  await page.waitForFunction(
    () =>
      getComputedStyle(document.getElementById("tool-card")!).opacity === "1",
  );
  await page.screenshot({ path: "docs/preview-mobile.png", fullPage: false });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("shared chrome, pinned steps and reduced-motion fallback remain readable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "ready");
  await expect(page.locator(".brand img")).toHaveAttribute(
    "src",
    "/brand/doctorfizz-white.png",
  );
  await page.getByRole("link", { name: "What it does", exact: true }).click();
  await expect(page.locator("#nav")).toHaveClass(/stuck/);
  await expect(page.locator("#does .does").first()).toBeVisible();
  await page.getByRole("link", { name: "How it works", exact: true }).click();
  await expect(page.locator("#pin-stack .pcard").first()).toBeVisible();
  await page.mouse.wheel(0, 1200);
  await expect(page.locator("#pin-nav li.on")).not.toHaveText(
    /Enter your brand/,
  );
  await page.getByRole("link", { name: "FAQ", exact: true }).click();
  await page.locator(".faq summary").nth(1).click();
  await expect(page.locator(".faq details").nth(1)).toHaveAttribute("open", "");
  await page.screenshot({ path: "docs/preview-faq.png" });
  expect(errors.filter((x) => !x.includes("hydration"))).toEqual([]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator("#pin-stack .pcard")).toHaveCount(4);
  expect(
    await page
      .locator("#pin-stack .pcard")
      .evaluateAll((cards) =>
        cards.every((c) => getComputedStyle(c).position === "static"),
      ),
  ).toBe(true);
});
