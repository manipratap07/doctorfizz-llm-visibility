# LLM Visibility Checker — Build Brief

You are a senior full-stack engineer and product designer. Build a production-ready, free, public web tool called **LLM Visibility Checker**. Read this entire brief before writing any code. If something is unspecified, choose a sensible default, record it under "Assumptions" in the README, and keep going. Only stop to ask if a decision is truly blocking.

---

## 1. What the tool does

A visitor enters their website and brand name. The tool suggests **5 realistic, brand-neutral prompts** that real customers would ask an AI assistant in the visitor's industry. The visitor picks **one prompt** and picks **which LLMs** to test (**at least 10 LLMs** must be available). The tool runs that prompt on all chosen LLMs **in parallel**, collects each LLM's real answer, and then shows, per LLM:

- whether the brand is visible or not
- at what position it appears (e.g. "#3 of 8 recommended")
- whether the brand's domain is cited as a source
- how the brand is described (sentiment + the exact snippet)
- which competitors appear instead

It is a free lead-gen tool in the style of a "free keyword rank checker": no signup to start, and **5 free checks per visitor**. Definition: **1 check = 1 prompt run across the selected LLMs.**

---

## 2. Non-negotiable principles

1. **Real data only.** No mocked or invented results in production. Mock adapters are allowed only behind `NODE_ENV=development`.
2. **Failed is not "not visible".** If an LLM times out, is blocked, rate-limited or errors, show it as **Unavailable** with a reason. It must never be counted as "brand not found", and it must be excluded from the score denominator.
3. **Transparency on every result.** Show provider name, model ID as reported, whether live web search was on, timestamp, whether the response was served from cache (and its age), and the raw answer in a collapsible view.
4. **Brand-neutral prompts.** A prompt must never contain the brand name or domain. Otherwise the test is biased.
5. **Results are snapshots.** LLM answers vary between runs. Show a short disclaimer, and never present a result as a permanent or absolute ranking.
6. **API-first, Playwright where there is no API.** Playwright is used only for providers without a usable public API (see section 7).
7. **No anti-bot evasion.** Never implement CAPTCHA solving, stealth plugins, fingerprint spoofing, proxy rotation to dodge blocks, or shared/stolen accounts. If a login wall, CAPTCHA or block appears, return `status: "blocked"` and stop.
8. **Secrets stay server-side.** No API key ever reaches the browser.

---

## 3. Tech stack and architecture

Use the latest stable versions of everything below.

- **Web app:** Next.js (App Router) + TypeScript + Tailwind CSS. Zod for all input validation.
- **Database:** PostgreSQL (Supabase or Neon) with Drizzle or Prisma.
- **Queue and cache:** Redis + BullMQ.
- **Worker service:** a separate Node service, deployed with Docker. It runs provider jobs and the Playwright adapters. Playwright cannot run reliably on serverless functions, so do not put it in the Next.js app. Use the official Playwright Docker image.
- **Live updates:** Server-Sent Events (SSE) with a polling fallback.
- **Bot protection:** Cloudflare Turnstile on the "Run check" action.
- **Observability:** structured logging (pino) and Sentry (optional via env).

Provide a Mermaid architecture diagram in the README.

---

## 4. User flow (single-page tool experience)

**Step 1: Input.**
Fields: Website URL (required), Brand / company name (required, prefilled from the site title when possible), Country/City (optional, used for local prompts), Brand aliases (optional, comma-separated). CTA: "Analyze my brand".

**Step 2: Site analysis (does not consume a free check).**
Server fetches the homepage safely (see SSRF rules in section 11) and extracts title, meta description, H1/H2s, and JSON-LD. A cheap LLM call with a strict JSON schema returns: `category`, `subCategory`, `primaryOffering`, `targetAudience`, `isLocalBusiness`, `location`, `language`, `confidence`. Show these as editable chips (category, audience, location). If the user edits a chip, regenerate the prompts without consuming a check. If the site is unreachable or confidence is low, ask the user to type their category manually and continue.

**Step 3: Prompt selection.**
Show exactly **5 prompt cards** (radio selection). Each card shows a type label, the full prompt text, and a "Copy" button. The visitor picks one. See section 5 for how they are generated.

**Step 4: LLM selection.**
Show a grid of LLM chips (logo + name + small tag such as "Live web" or "Knowledge only"). All are selected by default, with "Select all / Clear" controls. At least 1 must be selected. Show the free-checks counter ("4 of 5 free checks left") next to the Run button.

**Step 5: Run.**
Button: "Check my visibility". Validate Turnstile, enforce limits, create the check, and enqueue one job per LLM. Show one progress card per LLM with states `queued → running → done / unavailable`. Cards update live as each LLM finishes. Do not wait for the slowest one to show results.

**Step 6: Results.** See section 9.

If the user closes the tab, the job keeps running. Results stay available at `/check/:id` (unguessable ID, retained 7 days).

---

## 5. The 5 prompts (must produce real, useful data)

Generate prompts dynamically from the site profile. Never hardcode industry-specific prompts.

**Rules**

- Written the way a real person types to an AI assistant, 8 to 30 words each.
- Contain the category, plus location when the business is local, plus a clear buying or discovery intent.
- Never contain the brand name, aliases or domain. Validate this in code and regenerate if violated.
- Each of the 5 covers a different intent so the visitor sees different parts of their visibility.

**The 5 intents (templates to adapt, not to copy literally)**

1. **Best-of list:** "What are the best {category} {in location}? Give me a ranked list."
2. **Problem to solution:** "I need to {problem the offering solves}. Which {category} would you recommend and why?"
3. **Comparison:** "Compare the leading {category} options on pricing, features and reliability."
4. **Audience/use-case:** "Which {category} is best for {targetAudience}?"
5. **Trust/buying decision:** "Which {category} {in location} is the most trusted, with good customer reviews?"

If confidence is low, fall back to generic category templates and show a "Confirm your category for better prompts" nudge.

---

## 6. Provider registry (at least 10 LLMs)

Create `providers.config.ts` as the single source of truth. Each entry has: `id`, `displayName`, `logo`, `tier`, `adapter` (`"api"` or `"playwright"`), `modelId` (from env), `webSearch` (boolean), `timeoutMs`, `maxConcurrency`, `enabled`.

**Do not hardcode model IDs.** Read them from env vars and check each provider's official documentation at build time for the current model IDs and web-search tool syntax.

| Tier | Provider                      | Adapter                                                                           | Notes                                 |
| ---- | ----------------------------- | --------------------------------------------------------------------------------- | ------------------------------------- |
| A    | ChatGPT (OpenAI)              | API                                                                               | Enable the built-in web search tool   |
| A    | Claude (Anthropic)            | API                                                                               | Enable the web search tool            |
| A    | Gemini (Google)               | API                                                                               | Enable Google Search grounding        |
| A    | Perplexity                    | API (Sonar)                                                                       | Returns citations natively            |
| A    | Grok (xAI)                    | API                                                                               | Enable live search if offered         |
| B    | DeepSeek                      | API                                                                               | Label "Knowledge only" if no search   |
| B    | Mistral                       | API                                                                               | Use web search if offered, else label |
| B    | Llama (Meta)                  | API via Groq/Together/OpenRouter                                                  | Label web search status honestly      |
| B    | Qwen (Alibaba)                | API                                                                               | Label web search status honestly      |
| B    | Cohere Command                | API                                                                               | Use web search connector if available |
| C    | Microsoft Copilot             | Playwright                                                                        | Experimental, flag-gated              |
| C    | Google AI Overviews / AI Mode | SERP-data API preferred (e.g. DataForSEO or SerpAPI), Playwright only as fallback | Experimental, flag-gated              |

Tier A and B give 10 LLMs that work without any browser automation. Tier C is a bonus. Gate it behind `TIER_C_ENABLED` (default `false`).

**Adapter contract (every provider implements it)**

```ts
interface ProviderAdapter {
  id: string;
  run(input: { prompt: string; locale?: string; signal: AbortSignal }): Promise<ProviderResult>;
}

type ProviderResult = {
  status: 'ok' | 'timeout' | 'blocked' | 'rate_limited' | 'error';
  answerText?: string;
  citations?: { url: string; title?: string; domain: string }[];
  modelReported?: string;
  webSearchUsed: boolean;
  latencyMs: number;
  errorReason?: string;
};

```

Adding a new LLM must mean adding one adapter file and one config entry. Document this in the README.

---

## 7. Run engine

- `POST /api/checks` validates input, enforces limits, creates a `check` row plus one `llm_run` row per selected provider, and enqueues one BullMQ job per provider.
- Per-provider concurrency limits and per-provider timeouts (API: 45 s, Playwright: 90 s). Retry once with backoff on 429/5xx. Never retry on `blocked`.
- Overall check deadline: 120 s. After that, finalize with whatever completed and mark the rest `timeout`.
- **Response cache:** cache the **raw provider response** keyed by `hash(promptText + providerId + modelId + webSearch)` with TTL from `CACHE_TTL_HOURS` (default 6). The brand analysis is always computed fresh on top of the cached raw answer. Always display "Cached, X hours old" when a cached response is used.
- `RUNS_PER_PROVIDER` config (default 1). If greater than 1, aggregate as "mentioned in k of n runs".
- If **every** provider fails because of our side (not the user's input), refund the free check automatically.
- SSE endpoint streams `run.updated` and `check.completed` events.

### Playwright adapters (Tier C only)

- Run only in the worker. One fresh browser context per run, closed afterwards. No persisted cookies, no logged-in accounts.
- Limit browser instances per worker, 1 concurrent session per target site, and enforce memory limits.
- Locators live in a per-provider config file. Prefer role/text locators with fallbacks over brittle CSS selectors.
- Wait for completion by checking that the "stop generating" state ends and the answer DOM has been stable for a few seconds.
- Extract the final answer text and all outbound citation links.
- On login wall, CAPTCHA, consent wall that cannot be dismissed normally, or rate limit: return `blocked`/`rate_limited` and stop. Save an internal-only screenshot for debugging.
- Include a `npm run adapters:health` script that runs a sample prompt through every enabled adapter and reports which ones are broken. Schedule it daily and alert on failure.
- Add a code comment and README note: the project owner must review each provider's terms before enabling its Tier C adapter in production.

---

## 8. Analysis engine

Input: raw `answerText`, `citations[]`, and the brand `{ name, aliases[], domain }`.

1. **Alias building.** Brand name, no-space and hyphenated variants, the domain root (e.g. `acme.com` gives `acme`), and user-provided aliases. Normalize case, diacritics and punctuation.
2. **Mention detection.** Word-boundary matching on all aliases. If the brand name is a common dictionary word (e.g. "Apple", "Notion"), flag it as ambiguous and require a second signal (domain in citations, or appearing inside a recommended-entities list) before counting it.
3. **Entity extraction.** Call a cheap, fast model (env `EXTRACTOR_MODEL`) with a strict JSON schema to return the ordered list of brands/companies the answer recommends: `[{ name, position, snippet, sentiment }]`. **Validate that every `snippet` exists as a substring of the raw answer and drop any that do not.** Fall back to regex over numbered/bulleted lists if the extractor fails.
4. **Per-provider metrics:** 
   - `status` (`ok | unavailable | blocked | timeout | error`) plus `reason`
   - `mentioned` (boolean)
   - `position` (1-based among extracted entities, or `null` if mentioned but unordered) and `totalEntities`
   - `cited` (boolean) and `citationUrls[]` where the brand's domain appears
   - `sentiment` (`positive | neutral | negative`) and the supporting `snippet`
   - `competitors[]` (other entities in the answer)
5. **Provider visibility score (0 to 100):** 
   - Not found: 0
   - Mentioned: base 40
   - Position bonus: #1 = +40, #2 = +32, #3 = +26, #4 = +20, #5 = +15, #6 or lower = +10, unordered mention = +10
   - Cited as a source: +15
   - Sentiment: positive +5, neutral +2, negative 0
6. **Overall score** = average of provider scores over providers with `status = ok` only. Labels: 70+ "Strong", 40 to 69 "Moderate", 1 to 39 "Weak", 0 "Not visible".
7. Keep all weights in one config file and show a "How we score" modal in the UI.

---

## 9. Results UI

- **Summary header:** brand, domain, prompt used, timestamp, overall score ring with label, "Visible on X of Y LLMs", average position, "Cited by X LLMs", and "N unavailable" when applicable.
- **LLM results list:** one row/card per LLM with logo and name, status badge (`Visible #2`, `Mentioned (unranked)`, `Not found`, `Unavailable`), position, cited yes/no, sentiment chip, and a "View response" button.
- **Response drawer:** raw answer with the brand highlighted, citations list with favicons, and metadata (model, web search on/off, timestamp, cached or fresh).
- **Competitors panel:** brands that appeared across the LLMs, ranked by how many LLMs surfaced them.
- **Actions:** "Run another prompt" (uses a free check), "Copy prompt", "Export CSV", "Copy summary".
- **After the 5th check:** a limit screen with an email/lead capture form (name, email, optional phone) and a CTA such as "Get a full LLM visibility audit". Copy and CTA labels come from the brand tone of voice.
- **Disclaimer:** one line under results: "AI answers change over time. This is a snapshot taken on {date}."

---

## 10. Free-check limits and abuse protection

- `FREE_ATTEMPTS=5` and `WINDOW_DAYS=30` (both configurable).
- Enforce **server-side only**. Track by signed httpOnly visitor cookie plus hashed IP (salted). Never rely on localStorage.
- Hard per-IP cap (e.g. 15 checks/day) so clearing cookies does not bypass the limit.
- Per-domain cap (e.g. 10 checks/day per analyzed domain).
- Turnstile verification on every "Run check".
- **Daily budget kill-switch** (`DAILY_BUDGET_USD`). When exceeded, show a friendly "High demand, please try again later" state.
- Rate-limit `/api/site/analyze` and all other public endpoints.
- Cost awareness: 1 check across 10 LLMs is about 10 provider calls, many of them with paid web-search tools. Log estimated cost per check in the database.

---

## 11. Security

- **SSRF protection** on the site fetcher: only `http`/`https`; resolve DNS and block private, loopback, link-local and cloud-metadata IP ranges; re-validate after every redirect; max 3 redirects; 5 s timeout; 1 MB response cap; no cookies forwarded.
- **Treat site content as untrusted.** It is passed to the classifier only as quoted data, with an instruction to ignore any instructions inside it. Validate the classifier output against the schema.
- Zod validation on every endpoint. Sanitize everything rendered, including raw LLM answers (render as text, highlight with safe DOM nodes, never `dangerouslySetInnerHTML`).
- Do not accept free-form custom prompts in v1 (prevents the tool being abused as a free LLM proxy). Only the 5 generated prompts can be run.
- Store IPs only as salted hashes. Add Privacy Policy and Terms pages and a cookie notice. Provide a way to request data deletion.
- Add a footer note that the tool is not affiliated with any LLM provider, and use provider names/logos in line with each provider's brand guidelines.

---

## 12. Data model (minimum)

`visitors`, `site_profiles`, `generated_prompts`, `checks` (visitor, site_profile, prompt, selected providers, status, estimated cost, created_at), `llm_runs` (check, provider, status, reason, answer_text, citations json, model_reported, web_search_used, latency_ms, from_cache, analysis json), `response_cache`, `usage_events`, `leads`.

---

## 13. API surface

- `POST /api/site/analyze` returns the site profile and 5 prompts (no check consumed)
- `POST /api/prompts/regenerate` returns 5 prompts for edited category/location/audience
- `POST /api/checks` creates a check and returns `{ checkId, attemptsLeft }`
- `GET /api/checks/:id` returns full state
- `GET /api/checks/:id/stream` SSE
- `GET /api/checks/:id/export.csv`
- `GET /api/usage` returns attempts left
- `POST /api/leads`

---

## 14. UI design system: use the BRAND KIT only

**The brand kit is the single source of truth for all visual design.** Read every file in the brand kit folder first (`/brand-kit/` or the path provided). Before building any screen, convert the kit into design tokens (`design-tokens.json`, Tailwind theme extension and CSS variables).

**Token checklist (fill from the brand kit; if something is missing, ask or mark TODO, never invent):**

| Token group                                     | Value from brand kit    |
| ----------------------------------------------- | ----------------------- |
| Primary / secondary / accent colors             | `[FILL FROM BRAND KIT]` |
| Neutrals (background, surface, border, text)    | `[FILL FROM BRAND KIT]` |
| Semantic colors (success, warning, error, info) | `[FILL FROM BRAND KIT]` |
| Font families, weights, type scale              | `[FILL FROM BRAND KIT]` |
| Spacing scale, border radius, shadows           | `[FILL FROM BRAND KIT]` |
| Logo variants and clear-space rules             | `[FILL FROM BRAND KIT]` |
| Button, input, card, badge styles               | `[FILL FROM BRAND KIT]` |
| Iconography and illustration style              | `[FILL FROM BRAND KIT]` |
| Tone of voice for microcopy and CTAs            | `[FILL FROM BRAND KIT]` |
| Light / dark mode rules                         | `[FILL FROM BRAND KIT]` |

**Rules**

- No hardcoded hex values, fonts or radii outside the token files.
- Load brand fonts via `next/font`.
- Meet WCAG AA contrast. If a brand color fails on a surface, use the nearest passing neutral and note it in the README.
- All microcopy follows the brand tone of voice.

**Screens and components:** header (logo + free-checks badge), hero with the input form, site-analysis loading state, editable category chips, `PromptCard` (x5), `LlmChip` grid, run progress cards, `ScoreRing`, `ProviderResultRow`, `ResponseDrawer`, competitors panel, limit/lead-capture screen, "How it works" (3 steps), FAQ (6+ questions about LLM visibility), final CTA band, footer.

**Quality bar:** mobile-first and fully responsive; skeleton loaders; empty, error and unavailable states for every screen; keyboard navigable with visible focus; `aria-live` on progress updates; motion kept subtle and disabled under `prefers-reduced-motion`.

**SEO:** unique title and meta description, Open Graph image, JSON-LD (`SoftwareApplication` and `FAQPage`), clean URLs. Add privacy-friendly analytics events: `site_analyzed`, `prompt_selected`, `check_started`, `check_completed`, `limit_reached`, `lead_submitted`.

---

## 15. Edge cases to handle

Invalid or unreachable URL; site that blocks our fetcher (continue with manual category); very generic brand names; brands with no web presence; a provider outage mid-check; all providers failing (refund the check); duplicate submits (idempotency key); user changing category after prompts were generated; very long answers (truncate in the list, full in the drawer); non-English sites (detect language, show a note that v1 prompts are English).

---

## 16. Testing and acceptance criteria

**Tests**

- Unit: alias builder, ambiguous-name handling, mention/position extraction, snippet-substring validation, scoring, SSRF guard, limit counter.
- Integration: full check flow with mocked adapters, including partial failures and timeouts.
- E2E (Playwright test runner): input to prompts to LLM select to live progress to results to limit screen.
- A golden set of 10 sample brands, spot-checked manually against the real LLM apps.

**The build is accepted only when**

- [ ] At least 10 LLMs are selectable and run in parallel, with results appearing one by one
- [ ] 5 dynamic, brand-neutral prompts are generated from the analyzed site and validated
- [ ] Results show visibility, position, citation, sentiment, competitors and raw answer per LLM
- [ ] Unavailable providers are clearly labelled and excluded from the score
- [ ] The free-check limit of 5 is enforced server-side and cannot be bypassed by clearing storage
- [ ] Turnstile, rate limits and the daily budget kill-switch work
- [ ] Every screen uses brand-kit tokens only (no stray hex values)
- [ ] The README covers setup, env vars, architecture diagram, how to add a provider, and how to fix a broken Playwright adapter

---

## 17. Build order

Work in phases. After each phase, run the tests, summarize what is done, and list assumptions before moving on.

1. Project setup, design tokens from the brand kit, base UI and the full static flow (dev-only mock adapters)
2. Site analysis and the 5-prompt generator
3. Tier A API adapters, queue, SSE, caching
4. Analysis engine and results UI
5. Tier B adapters
6. Limits, Turnstile, budget kill-switch, lead capture
7. Tier C Playwright worker (flag-gated) and the adapter health check
8. SEO, accessibility pass, tests, README, deployment (web app on a Node host, worker + Redis + Postgres via Docker)

---

## 18. Environment variables (create `.env.example`)

`DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY`, `XAI_API_KEY`, `DEEPSEEK_API_KEY`, `MISTRAL_API_KEY`, `GROQ_API_KEY` (or `TOGETHER_API_KEY` / `OPENROUTER_API_KEY`), `QWEN_API_KEY`, `COHERE_API_KEY`, `SERP_API_KEY`, a `*_MODEL_ID` for each provider, `EXTRACTOR_MODEL`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `FREE_ATTEMPTS`, `WINDOW_DAYS`, `CACHE_TTL_HOURS`, `RUNS_PER_PROVIDER`, `DAILY_BUDGET_USD`, `TIER_C_ENABLED`, `IP_HASH_SALT`, `SENTRY_DSN`, `ANALYTICS_ID`.