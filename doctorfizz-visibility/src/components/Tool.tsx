"use client";
import { SharedHeader, SharedFooter } from "./SharedChrome";
import SharedLanding, { Stack } from "./SharedLanding";
import { track } from "./events";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Check as CheckIcon,
  Copy,
  Download,
  Globe,
  Search,
  Radio,
  ChevronDown,
  X,
  Loader2,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import type { Brand, SiteProfile, Prompt, Check, Run } from "@/lib/types";
import { summarize } from "@/lib/analysis";
import { weights } from "@/lib/scoring.config";
type Provider = {
  id: string;
  displayName: string;
  tier: string;
  webSearch: boolean;
  configured?: boolean;
  enabled?: boolean;
};
declare global {
  interface Window {
    DFMotion?: {
      openModal: (element: HTMLElement) => void;
      revealResult: (
        result: HTMLElement,
        summary: HTMLElement | null,
        rows: HTMLElement | null,
      ) => void;
      scrollToTool: (element: HTMLElement) => void;
    };
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}
const faq = [
  [
    "What does this check measure?",
    "It sends one neutral customer question to the selected provider APIs and checks their answers for your brand, recommendations and website citations.",
  ],
  [
    "Is this the same as using each consumer AI app?",
    "No. These are API snapshots. Consumer apps can use different models, personalisation and search settings. The exact model and observed search activity are shown with every answer.",
  ],
  [
    "Why are the prompts brand-neutral?",
    "Mentioning your brand in the question would bias the answer. We test whether it appears when a customer asks about the category.",
  ],
  [
    "What happens if a provider fails?",
    "It is marked unavailable and excluded from the score. If all selected providers fail, the check is refunded automatically.",
  ],
  [
    "How do the five free checks work?",
    "One prompt across your selected providers counts as one check. You receive five checks per 30-day visitor window, with additional daily limits to protect the free tool.",
  ],
  [
    "Are these permanent rankings?",
    "No. Each answer is a snapshot. A different prompt, model, search state or date can produce a different result.",
  ],
  [
    "Can I see or export the evidence?",
    "Yes. Open any completed response to read the exact answer, citations, model, timestamp and cache status. You can also export a CSV.",
  ],
];
async function api(path: string, data?: unknown) {
  const r = await fetch(path, {
    method: data ? "POST" : "GET",
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Request could not be completed.");
  return j;
}
const short = (p: Provider) => p.displayName.split(" · ")[0];
function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (s: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef<string | undefined>(undefined);
  const render = () => {
    if (window.turnstile && ref.current && !id.current)
      id.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        theme: "dark",
        action: "visibility",
        callback: onToken,
        "expired-callback": () => onToken(""),
      });
  };
  useEffect(() => {
    render();
    return () => {
      if (id.current) window.turnstile?.remove(id.current);
    };
  }, [siteKey]);
  if (!siteKey)
    return <p className="note">Live checks are awaiting verification setup.</p>;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={render}
      />
      <div ref={ref} />
    </>
  );
}
function Highlight({ text, brand }: { text: string; brand: Brand }) {
  const names = [brand.name, ...brand.aliases]
    .filter(Boolean)
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!names.length) return <>{text}</>;
  const regex = new RegExp("(" + names.join("|") + ")", "gi");
  return (
    <>
      {text
        .split(regex)
        .map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))}
    </>
  );
}
export default function Tool({
  providers,
  turnstileKey,
  initialCheckId,
}: {
  providers: Provider[];
  turnstileKey: string;
  initialCheckId?: string;
}) {
  const [url, setUrl] = useState(""),
    [name, setName] = useState(""),
    [location, setLocation] = useState(""),
    [alias, setAlias] = useState(""),
    [manual, setManual] = useState(false),
    [category, setCategory] = useState("");
  const [profile, setProfile] = useState<SiteProfile | null>(null),
    [profileId, setProfileId] = useState(""),
    [brand, setBrand] = useState<Brand | null>(null),
    [prompts, setPrompts] = useState<Prompt[]>([]),
    [selectedPrompt, setSelectedPrompt] = useState("");
  const [chosen, setChosen] = useState(
      providers
        .filter((p) => p.enabled !== false && p.configured !== false)
        .map((p) => p.id),
    ),
    [token, setToken] = useState(""),
    [left, setLeft] = useState<number | null>(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [check, setCheck] = useState<Check | null>(null),
    [watchId, setWatchId] = useState(initialCheckId || ""),
    [drawer, setDrawer] = useState<Run | null>(null),
    [scoring, setScoring] = useState(false),
    [leadSent, setLeadSent] = useState(false),
    [cookie, setCookie] = useState(true);
  const resultsRef = useRef<HTMLElement>(null),
    promptRef = useRef<HTMLElement>(null),
    modalRef = useRef<HTMLDivElement>(null),
    requestKey = useRef<string>("");
  const [hydrated, setHydrated] = useState(false);
  const completionTracked = useRef("");
  useEffect(() => {
    if (left === 0) track("limit_reached");
  }, [left]);
  const active = !!check && check.status !== "completed";
  useEffect(() => {
    setHydrated(true);
    window.dispatchEvent(new Event("df:mount"));
    try {
      setCookie(sessionStorage.getItem("df_visibility_notice") !== "1");
    } catch {}
    api("/api/usage")
      .then((j) => setLeft(j.attemptsLeft))
      .catch(() => {});
    return () => {
      window.dispatchEvent(new Event("df:unmount"));
    };
  }, []);
  useEffect(() => {
    if (!watchId) return;
    let cancelled = false;
    let finished = false;
    let stream: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | undefined;
    const update = (c: Check) => {
      if (cancelled) return;
      setCheck(c);
      if (c.status === "completed") {
        finished = true;
        if (completionTracked.current !== c.id) {
          completionTracked.current = c.id;
          track("check_completed");
        }
        stream?.close();
        if (poll) clearInterval(poll);
        api("/api/usage")
          .then((j) => setLeft(j.attemptsLeft))
          .catch(() => {});
        setBusy("");
      }
    };
    api("/api/checks/" + watchId)
      .then(update)
      .catch((e) => setError(e.message));
    stream = new EventSource("/api/checks/" + watchId + "/stream");
    for (const event of ["run.updated", "check.completed"])
      stream.addEventListener(event, (e) =>
        update(JSON.parse((e as MessageEvent).data)),
      );
    stream.onerror = () => {
      stream?.close();
      if (finished || cancelled) return;
      if (!poll)
        poll = setInterval(
          () =>
            api("/api/checks/" + watchId)
              .then(update)
              .catch(() => {}),
          2500,
        );
    };
    return () => {
      cancelled = true;
      stream?.close();
      if (poll) clearInterval(poll);
    };
  }, [watchId]);
  useEffect(() => {
    if (!drawer && !scoring) return;
    if (modalRef.current) window.DFMotion?.openModal(modalRef.current);
    const previous = document.activeElement as HTMLElement;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawer(null);
        setScoring(false);
      }
      if (e.key === "Tab") {
        const nodes = modalRef.current?.querySelectorAll<HTMLElement>(
          'button,a,[tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", close);
    modalRef.current?.querySelector<HTMLElement>("button")?.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, [drawer, scoring]);
  useEffect(() => {
    window.dispatchEvent(new Event("df:layout"));
  }, [profile, check?.id, left]);
  useEffect(() => {
    if (
      check?.id &&
      resultsRef.current &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      window.DFMotion?.revealResult(resultsRef.current, null, null);
  }, [check?.id]);
  function scrollTo(el: HTMLElement | null) {
    if (!el) return;
    if (window.DFMotion) window.DFMotion.scrollToTool(el);
    else
      el.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
  }
  async function prefillBrand() {
    if (!url || name) return;
    try {
      const j = await api("/api/site/title", { url });
      setName((current) => current || j.name || "");
    } catch {
      /* Optional title detection must not block manual input. */
    }
  }
  async function analyzeSite(e: React.FormEvent) {
    e.preventDefault();
    setBusy("Reading your website");
    setError("");
    setNotice("");
    try {
      const j = await api("/api/site/analyze", {
        url,
        name,
        location,
        aliases: alias
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        category,
      });
      if (j.needsCategory) {
        setManual(true);
        setNotice(j.note);
        return;
      }
      track("site_analyzed");
      setCheck(null);
      setWatchId("");
      setProfile(j.profile);
      setProfileId(j.profileId);
      setBrand(j.brand);
      setPrompts(j.prompts);
      setSelectedPrompt(j.prompts[0].id);
      setNotice(j.languageNote || j.note || "");
      requestKey.current = "";
      setTimeout(() => scrollTo(promptRef.current), 100);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function regenerate() {
    if (!profile) return;
    setBusy("Building neutral prompts");
    setError("");
    try {
      const j = await api("/api/prompts/regenerate", { profileId, profile });
      setPrompts(j.prompts);
      setSelectedPrompt(j.prompts[0].id);
      setCheck(null);
      setWatchId("");
      requestKey.current = "";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function run() {
    setBusy("Preparing check");
    setError("");
    try {
      requestKey.current ||= crypto.randomUUID();
      const j = await api("/api/checks", {
        profileId,
        promptId: selectedPrompt,
        providers: chosen,
        turnstileToken: token,
        idempotencyKey: requestKey.current,
      });
      track("check_started");
      setLeft(j.attemptsLeft);
      setWatchId(j.checkId);
      setCheck(await api("/api/checks/" + j.checkId));
      window.history.replaceState({}, "", "/check/" + j.checkId);
      requestKey.current = "";
      window.turnstile?.reset();
      setToken("");
      setTimeout(() => scrollTo(resultsRef.current), 100);
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied.");
    } catch {
      setNotice("Your browser could not copy this text.");
    }
  }
  const summary = check ? summarize(check.runs) : null;
  const ok = check?.runs.filter((r) => r.status === "ok") || [];
  const positions = ok.flatMap((r) =>
    r.analysis?.position ? [r.analysis.position] : [],
  );
  const competitors = new Map<
    string,
    { name: string; providers: Set<string> }
  >();
  ok.forEach((r) =>
    r.analysis?.competitors.forEach((e) => {
      const key = e.name.toLowerCase();
      const value = competitors.get(key) || {
        name: e.name,
        providers: new Set<string>(),
      };
      value.providers.add(r.provider_id);
      competitors.set(key, value);
    }),
  );
  const repeatStats = new Map<string, { ok: number; mentioned: number }>();
  ok.forEach((r) => {
    const stats = repeatStats.get(r.provider_id) || { ok: 0, mentioned: 0 };
    stats.ok++;
    if (r.analysis?.mentioned) stats.mentioned++;
    repeatStats.set(r.provider_id, stats);
  });
  const repeated = !!check && check.runs.some((r) => r.repeat_index > 0);
  const complete = check?.status === "completed";
  const uniqueOk = new Set(ok.map((r) => r.provider_id));
  const uniqueVisible = new Set(
    ok.filter((r) => r.analysis?.mentioned).map((r) => r.provider_id),
  );
  return (
    <>
      <a href="#tool" className="skip">
        Skip to the tool
      </a>
      <SharedHeader />
      <Script src="/reference/js/bootstrap.js" strategy="afterInteractive" />
      <main data-ready={hydrated}>
        {cookie && (
          <div className="cookie">
            <p>
              We use an essential cookie to keep your free-check allowance.{" "}
              <Link href="/privacy">Details</Link>
            </p>
            <button
              aria-label="Dismiss cookie notice"
              onClick={() => {
                setCookie(false);
                try {
                  sessionStorage.setItem("df_visibility_notice", "1");
                } catch {}
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        <section className="hero" id="tool">
          <canvas id="hero-canvas" aria-hidden="true" />
          <div className="hero-glow" aria-hidden="true" />
          <div className="shell hero-in">
            <div className="hero-copy">
              <p className="kicker" data-kicker>
                <span className="dot" aria-hidden="true" />
                Free LLM visibility checker
              </p>
              <Stack first="WHERE DOES" last="AI SEE YOU?" level={1} />
              <p className="hero-description" data-deck>
                One brand. One customer question. See which AI providers name
                you, which competitors they recommend and the evidence behind
                every answer.
              </p>
              <dl className="facts" data-facts>
                {[
                  ["Free checks", 5],
                  ["AI providers", 10],
                  ["Prompt choices", 5],
                  ["Signup fields", 0],
                ].map(([label, n]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd data-count={n}>{n}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div
              className={"input-panel" + (busy ? " busy" : "")}
              id="tool-card"
            >
              <div className="tool-top">
                <h2>Check your brand</h2>
                <span className="allowance">
                  <i />
                  {left === null
                    ? "Checking allowance"
                    : `${left} checks remaining`}
                </span>
              </div>
              {error && !profile && (
                <p className="error tool-error" role="alert">
                  {error}
                </p>
              )}
              {notice && !profile && (
                <p className="note" role="status">
                  {notice}
                </p>
              )}
              <form onSubmit={analyzeSite}>
                <label>
                  Website URL
                  <div className="input-icon">
                    <Globe size={17} />
                    <input
                      required
                      autoComplete="url"
                      aria-label="Website URL"
                      placeholder="yourwebsite.com"
                      value={url}
                      onBlur={prefillBrand}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </div>
                </label>
                <label>
                  Brand / company name
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    autoComplete="organization"
                    placeholder="The name customers know"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <div className="field-row">
                  <label>
                    Country or city <span>Optional</span>
                    <input
                      maxLength={100}
                      placeholder="e.g. Bengaluru, India"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </label>
                  <label>
                    Brand aliases <span>Optional</span>
                    <input
                      placeholder="Acme, AcmeCloud"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                    />
                  </label>
                </div>
                {manual && (
                  <label>
                    Business category
                    <input
                      required
                      placeholder="e.g. accounting software"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      maxLength={100}
                    />
                  </label>
                )}
                <button
                  className="primary wide"
                  disabled={!!busy || active}
                  type="submit"
                >
                  {busy && !active ? (
                    <>
                      <Loader2 className="spin" size={17} />
                      {busy}
                    </>
                  ) : (
                    <>
                      Analyse my brand
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
              <p className="footnote">
                <ShieldCheck size={14} /> Site analysis does not use a free
                check.
              </p>
              <div className="input-bottom">
                <span className="mono">REAL RESPONSES. TRACEABLE SOURCES.</span>
                <div className="meter">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </div>
          </div>
        </section>
        {busy && !profile && (
          <section className="wrap analysis-loading" role="status">
            <div className="kicker">
              <Loader2 size={14} className="spin" />
              READING YOUR WEBSITE
            </div>
            <p className="secondary">
              Checking the category, audience and location before building your
              questions.
            </p>
            <div className="skeleton-row">
              <i />
              <i />
              <i />
            </div>
          </section>
        )}
        <div className="wrap notices" aria-live="polite">
          {error && profile && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {notice && profile && <p className="note">{notice}</p>}
        </div>
        {profile && (
          <section className="wrap workspace" ref={promptRef}>
            <div className="section-top">
              <div>
                <div className="kicker">02 / CHOOSE THE QUESTION</div>
                <h2>
                  What would your
                  <br />
                  <span className="gradient">customer ask?</span>
                </h2>
              </div>
              <p className="secondary">
                Five different buying intents.
                <br />
                Your brand stays out of the question.
              </p>
            </div>
            <div className="profile-panel">
              <label>
                Category
                <input
                  value={profile.category}
                  maxLength={100}
                  onChange={(e) =>
                    setProfile({ ...profile, category: e.target.value })
                  }
                />
              </label>
              <label>
                Audience
                <input
                  value={profile.targetAudience}
                  maxLength={100}
                  onChange={(e) =>
                    setProfile({ ...profile, targetAudience: e.target.value })
                  }
                />
              </label>
              <label>
                Location
                <input
                  value={profile.location}
                  maxLength={100}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      location: e.target.value,
                      isLocalBusiness: !!e.target.value,
                    })
                  }
                />
              </label>
              <button
                className="secondary-button"
                disabled={!!busy || active}
                onClick={regenerate}
              >
                Update prompts
              </button>
            </div>
            <div
              className="prompts"
              role="radiogroup"
              aria-label="Choose one prompt"
            >
              {prompts.map((p, i) => (
                <div
                  className={
                    "prompt-card " + (p.id === selectedPrompt ? "selected" : "")
                  }
                  key={p.id}
                >
                  <label>
                    <input
                      type="radio"
                      name="prompt"
                      checked={p.id === selectedPrompt}
                      disabled={active}
                      onChange={() => {
                        setSelectedPrompt(p.id);
                        track("prompt_selected");
                        requestKey.current = "";
                      }}
                    />
                    <span className="mono">
                      0{i + 1} / {p.type.toUpperCase()}
                    </span>
                    <p>{p.text}</p>
                  </label>
                  <button
                    className="icon-button"
                    aria-label={"Copy " + p.type + " prompt"}
                    onClick={() => copy(p.text)}
                  >
                    <Copy size={15} />
                  </button>
                </div>
              ))}
            </div>
            <div className="selection-head">
              <div>
                <div className="kicker">03 / SELECT YOUR PROVIDERS</div>
                <h3>Who should answer?</h3>
              </div>
              <div className="select-actions">
                <button
                  disabled={active}
                  onClick={() =>
                    setChosen(
                      providers
                        .filter(
                          (p) => p.enabled !== false && p.configured !== false,
                        )
                        .map((p) => p.id),
                    )
                  }
                >
                  Select all
                </button>
                <span>/</span>
                <button disabled={active} onClick={() => setChosen([])}>
                  Clear
                </button>
              </div>
            </div>
            <div className="providers">
              {providers.map((p) => (
                <button
                  className={
                    "llm-chip " + (chosen.includes(p.id) ? "selected" : "")
                  }
                  key={p.id}
                  disabled={
                    active || p.enabled === false || p.configured === false
                  }
                  aria-disabled={p.enabled === false}
                  aria-pressed={chosen.includes(p.id)}
                  onClick={() => {
                    setChosen(
                      chosen.includes(p.id)
                        ? chosen.filter((id) => id !== p.id)
                        : [...chosen, p.id],
                    );
                    requestKey.current = "";
                  }}
                >
                  <span className="provider-logo">{short(p).slice(0, 2)}</span>
                  <span>
                    <b>{short(p)}</b>
                    <small>
                      {p.configured === false || p.enabled === false
                        ? "Unavailable"
                        : p.tier === "C"
                          ? "Experimental"
                          : p.webSearch
                            ? "Web search available"
                            : "Knowledge only"}
                    </small>
                  </span>
                  <span className="checkbox">
                    {chosen.includes(p.id) && <CheckIcon size={13} />}
                  </span>
                </button>
              ))}
            </div>
            <div className="run-bar">
              <div>
                <b>
                  {left === null
                    ? "Checking allowance…"
                    : `${left} of 5 free checks left`}
                </b>
                <p className="secondary">
                  One prompt across {chosen.length} selected providers = one
                  check.
                </p>
              </div>
              <div className="run-controls">
                <Turnstile siteKey={turnstileKey} onToken={setToken} />
                <button
                  className="primary"
                  disabled={
                    active ||
                    !!busy ||
                    !chosen.length ||
                    !selectedPrompt ||
                    left === 0 ||
                    !token
                  }
                  onClick={run}
                >
                  {active ? (
                    <>
                      <Loader2 size={17} className="spin" />
                      Reading answers
                    </>
                  ) : (
                    <>
                      Check my visibility
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </div>
            </div>
            <p className="footnote">
              API responses can differ from consumer apps. Web search is
              reported as used only when confirmed by the response.
            </p>
          </section>
        )}
        {check && (
          <section className="wrap results" ref={resultsRef} aria-live="polite">
            <div className="section-top">
              <div>
                <div className="kicker">04 / YOUR VISIBILITY READOUT</div>
                <h2>{check.brand.name || "Deleted check"}</h2>
                <p className="secondary">{check.brand.domain}</p>
              </div>
              <span className={"tiny-badge " + (complete ? "success" : "")}>
                {complete ? "CHECK COMPLETE" : "READING THE SIGNAL"}
              </span>
            </div>
            {active && (
              <p className="progress-text" role="status">
                {
                  check.runs.filter(
                    (r) => !["queued", "running"].includes(r.status),
                  ).length
                }{" "}
                of {check.runs.length} responses received · checking the
                remaining providers
              </p>
            )}
            <div className="summary">
              <div
                className="score-ring"
                style={
                  {
                    "--score": `${(summary?.score || 0) * 3.6}deg`,
                  } as React.CSSProperties
                }
              >
                <div>
                  <strong>{summary?.score ?? "—"}</strong>
                  <span>{summary?.label}</span>
                </div>
              </div>
              <div className="summary-data">
                <div className="mono">OBSERVED AI VISIBILITY</div>
                <h3>
                  Visible on{" "}
                  <span>
                    {uniqueVisible.size} of {uniqueOk.size}
                  </span>{" "}
                  providers
                </h3>
                <div className="metrics">
                  <div>
                    <b>
                      {positions.length
                        ? (
                            positions.reduce((a, b) => a + b, 0) /
                            positions.length
                          ).toFixed(1)
                        : "—"}
                    </b>
                    <span>Average position</span>
                  </div>
                  <div>
                    <b>
                      {
                        new Set(
                          ok
                            .filter((r) => r.analysis?.cited)
                            .map((r) => r.provider_id),
                        ).size
                      }
                    </b>
                    <span>Providers citing you</span>
                  </div>
                  <div>
                    <b>
                      {
                        check.runs.filter(
                          (r) =>
                            !["ok", "queued", "running"].includes(r.status),
                        ).length
                      }
                    </b>
                    <span>Unavailable runs</span>
                  </div>
                </div>
                <button
                  className="text-button"
                  onClick={() => setScoring(true)}
                >
                  How we score <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
            <div className="used-prompt">
              <span className="mono">PROMPT TESTED</span>
              <p>{check.prompt_text}</p>
              <button
                className="icon-button"
                aria-label="Copy tested prompt"
                onClick={() => copy(check.prompt_text)}
              >
                <Copy size={15} />
              </button>
            </div>
            <div className="result-list">
              {check.runs.map((r) => {
                const p = providers.find((p) => p.id === r.provider_id);
                const pending = ["queued", "running"].includes(r.status);
                const found = r.analysis?.mentioned;
                const label = pending
                  ? r.status === "running"
                    ? "Reading answer"
                    : "Queued"
                  : r.status !== "ok"
                    ? "Unavailable"
                    : found
                      ? r.analysis?.position
                        ? `Visible #${r.analysis.position}`
                        : "Mentioned · unranked"
                      : "Not found";
                return (
                  <div className="result-row" key={r.id}>
                    <span className="provider-logo">
                      {p ? short(p).slice(0, 2) : "AI"}
                    </span>
                    <div className="result-name">
                      <b>{p ? short(p) : r.provider_id}</b>
                      <small>
                        {r.model_reported || "Model not reported"}
                        {repeated
                          ? ` · Run ${r.repeat_index + 1} · Mentioned in ${repeatStats.get(r.provider_id)?.mentioned || 0} of ${repeatStats.get(r.provider_id)?.ok || 0} successful runs`
                          : ""}
                      </small>
                    </div>
                    <span
                      className={
                        "result-status " +
                        (r.status === "ok" && found
                          ? "success"
                          : pending
                            ? "pending"
                            : "")
                      }
                    >
                      {pending && <Loader2 size={13} className="spin" />}
                      {label}
                    </span>
                    <div className="result-evidence">
                      {r.status === "ok" ? (
                        <>
                          <span>
                            {r.analysis?.cited
                              ? "Domain cited"
                              : "Domain not cited"}
                          </span>
                          <small>
                            {r.analysis?.sentiment || "neutral"}
                            {r.analysis?.position
                              ? ` · #${r.analysis.position} of ${r.analysis.totalEntities}`
                              : ""}
                          </small>
                        </>
                      ) : (
                        <small>{r.reason || "Waiting for the provider"}</small>
                      )}
                    </div>
                    <button
                      className="secondary-button"
                      disabled={!r.answer_text}
                      onClick={() => setDrawer(r)}
                    >
                      View response
                      <ArrowUpRight size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
            {check.refunded && (
              <p className="note">
                No provider returned a usable answer. Your free check was
                refunded.
              </p>
            )}
            {competitors.size > 0 && (
              <div className="competitors">
                <div>
                  <div className="kicker">ALSO IN THE ANSWER</div>
                  <h3>The brands appearing alongside you.</h3>
                </div>
                <div>
                  {[...competitors.values()]
                    .sort((a, b) => b.providers.size - a.providers.size)
                    .slice(0, 10)
                    .map((c, i) => (
                      <div className="competitor" key={c.name}>
                        <span className="mono">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <b>{c.name}</b>
                        <span>
                          {c.providers.size} provider
                          {c.providers.size === 1 ? "" : "s"}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
            <div className="result-actions">
              <button
                className="primary"
                disabled={!complete || left === 0}
                onClick={() => {
                  setWatchId("");
                  setCheck(null);
                  setBusy("");
                  window.history.replaceState({}, "", "/");
                  scrollTo(promptRef.current);
                }}
              >
                Run another prompt
                <ArrowRight size={16} />
              </button>
              <a
                className="secondary-button"
                href={"/api/checks/" + check.id + "/export.csv"}
              >
                <Download size={15} />
                Export CSV
              </a>
              <button
                className="secondary-button"
                onClick={() =>
                  copy(
                    `${check.brand.name}: ${summary?.score ?? "unavailable"}/100. Visible on ${uniqueVisible.size} of ${uniqueOk.size} successful providers. Prompt: ${check.prompt_text}. Captured ${check.created_at}. API snapshot, not a permanent ranking.`,
                  )
                }
              >
                <Copy size={15} />
                Copy summary
              </button>
            </div>
            <p className="footnote">
              AI answers change over time. This is a snapshot taken on{" "}
              {new Date(check.created_at).toLocaleString()}. Results are
              retained for seven days.
            </p>
          </section>
        )}
        {left === 0 && (!check || complete) && (
          <section className="wrap lead-panel">
            <div>
              <div className="kicker">YOU HAVE THE FIRST SIGNAL</div>
              <h2>
                Now find
                <br />
                <span className="gradient">the next move.</span>
              </h2>
              <p className="secondary">
                Your five checks are complete. Request a full LLM visibility
                audit to examine more prompts and the gaps worth fixing.
              </p>
            </div>
            {leadSent ? (
              <p role="status">
                Request received. Your details have been saved for the
                DoctorFizz team.
              </p>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  try {
                    await api("/api/leads", {
                      name: f.get("name"),
                      email: f.get("email"),
                      phone: f.get("phone"),
                      consent: f.get("consent") === "on",
                    });
                    setLeadSent(true);
                    track("lead_submitted");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <label>
                  Name
                  <input name="name" required autoComplete="name" />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                  />
                </label>
                <label>
                  Phone <span>Optional</span>
                  <input name="phone" autoComplete="tel" />
                </label>
                <label className="consent">
                  <input type="checkbox" name="consent" required />I agree to be
                  contacted about this audit.{" "}
                  <Link href="/privacy">Privacy policy</Link>
                </label>
                <button className="primary wide">
                  Get a full visibility audit
                  <ArrowRight size={17} />
                </button>
              </form>
            )}
          </section>
        )}
        <SharedLanding faq={faq} />
      </main>
      <SharedFooter />
      {(drawer || scoring) && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setDrawer(null);
            setScoring(false);
          }}
        >
          <div
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-head">
              <h2 id="drawer-title">
                {scoring
                  ? "How we score"
                  : providers.find((p) => p.id === drawer?.provider_id)
                      ?.displayName + " response"}
              </h2>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => {
                  setDrawer(null);
                  setScoring(false);
                }}
              >
                <X />
              </button>
            </div>
            {scoring ? (
              <>
                <p>
                  The overall score is the mean of successful runs. Failed runs
                  are excluded. This is a diagnostic score, not a provider
                  ranking.
                </p>
                <dl className="metadata">
                  <dt>Brand mentioned</dt>
                  <dd>+{weights.mention}</dd>
                  <dt>Position bonus</dt>
                  <dd>
                    #1 +40 · #2 +32 · #3 +26 · #4 +20 · #5 +15 · lower or
                    unordered +10
                  </dd>
                  <dt>Domain cited</dt>
                  <dd>+15</dd>
                  <dt>Sentiment</dt>
                  <dd>Positive +5 · neutral +2 · negative +0</dd>
                </dl>
                <p>
                  No mention scores 0. Maximum 100. Strong 70+, moderate 40–69,
                  weak 1–39.
                </p>
              </>
            ) : (
              drawer && (
                <>
                  <dl className="metadata">
                    <dt>Model reported</dt>
                    <dd>
                      {drawer.model_reported || "Not reported by provider"}
                    </dd>
                    <dt>Search observed</dt>
                    <dd>
                      {drawer.web_search_used
                        ? "Used"
                        : "Not confirmed / knowledge only"}
                    </dd>
                    <dt>Captured</dt>
                    <dd>
                      {new Date(
                        drawer.completed_at || drawer.created_at,
                      ).toLocaleString()}
                    </dd>
                    <dt>Cache</dt>
                    <dd>
                      {drawer.from_cache
                        ? `Cached · ${Math.max(0, (Date.now() - new Date(drawer.cache_created_at || drawer.created_at).getTime()) / 3600000).toFixed(1)} hours old`
                        : "Fresh response"}
                    </dd>
                    <dt>Provider latency</dt>
                    <dd>{drawer.latency_ms} ms</dd>
                  </dl>
                  <h3>Exact answer</h3>
                  <pre className="raw-answer">
                    <Highlight
                      text={drawer.answer_text || ""}
                      brand={check!.brand}
                    />
                  </pre>
                  <h3>Citations</h3>
                  {drawer.citations.length ? (
                    drawer.citations.map((c) => (
                      <a
                        className="citation"
                        href={c.url}
                        key={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Globe size={15} />
                        <span>
                          {c.title || c.domain}
                          <small>{c.url}</small>
                        </span>
                        <ExternalLink size={13} />
                      </a>
                    ))
                  ) : (
                    <p className="secondary">
                      No citations were returned by this provider.
                    </p>
                  )}
                </>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}
