import type { Analysis, Brand, Citation, Entity } from "./types";
import { getDomainWithoutSuffix } from "tldts";
import { weights } from "./scoring.config";
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function aliases(b: Brand) {
  const root =
    getDomainWithoutSuffix(b.domain, { allowPrivateDomains: true }) || "";
  return [
    ...new Set(
      [
        b.name,
        b.name.replace(/\s+/g, ""),
        b.name.replace(/\s+/g, "-"),
        root,
        ...b.aliases,
      ]
        .map(normalize)
        .filter((x) => x.length > 1),
    ),
  ];
}
export function matches(text: string, values: string[]) {
  const n = " " + normalize(text) + " ";
  return values.some((a) => n.includes(" " + a + " "));
}
export function fallbackEntities(text: string): Entity[] {
  return text
    .split("\n")
    .flatMap((line) => {
      const m = line.match(
        /^\s*(?:#{1,6}\s+)?(?:\*\*)?(?:\d+[.)]|[-*])\s+(?:\*\*)?([^:\n—–]+?)(?:\*\*|:|\s[—–]\s|$)/,
      );
      if (!m) return [];
      const name = m[1]
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\*+/g, "")
        .trim();
      const generic =
        /^(?:pros|cons|pricing|features|key features|summary|conclusion|recommendations?|best options|next steps|how to choose)$/i;
      return name &&
        name.length < 90 &&
        name.split(/\s+/).length <= 8 &&
        !generic.test(name) &&
        !/[!?]/.test(name)
        ? [
            {
              name,
              position: 1,
              snippet: line.trim(),
              sentiment: "neutral" as const,
            },
          ]
        : [];
    })
    .map((e, i) => ({ ...e, position: i + 1 }));
}
export function verifiedEntities(text: string, items: Entity[]) {
  const seen = new Set<string>();
  return items
    .filter(
      (e) =>
        text.includes(e.snippet) &&
        e.snippet.length > 0 &&
        matches(e.snippet, [normalize(e.name)]) &&
        !seen.has(normalize(e.name)) &&
        !!seen.add(normalize(e.name)),
    )
    .sort((a, b) => text.indexOf(a.snippet) - text.indexOf(b.snippet))
    .map((e, i) => ({ ...e, position: e.position === null ? null : i + 1 }));
}
const ambiguous = new Set([
  "apple",
  "notion",
  "linear",
  "buffer",
  "wise",
  "bolt",
  "square",
  "open",
  "next",
  "orange",
  "meta",
  "collective",
  "command",
  "Monday".toLowerCase(),
]);
export function analyze(
  text: string,
  citations: Citation[],
  brand: Brand,
  entities: Entity[] = fallbackEntities(text),
): Analysis {
  const aa = aliases(brand),
    es = verifiedEntities(text, entities);
  const host = brand.domain.toLowerCase().replace(/^www\./, "");
  const urls = citations
    .filter((c) => {
      try {
        const h = new URL(c.url).hostname.replace(/^www\./, "").toLowerCase();
        return h === host || h.endsWith("." + host);
      } catch {
        return false;
      }
    })
    .map((c) => c.url);
  const found = es.find((e) => matches(e.name, aa));
  const isAmbiguous = ambiguous.has(normalize(brand.name));
  const mentioned =
    matches(text, aa) && (!isAmbiguous || urls.length > 0 || !!found);
  const pos = mentioned ? (found?.position ?? null) : null;
  const sentiment = mentioned ? (found?.sentiment ?? "neutral") : "neutral";
  let snippet = mentioned ? found?.snippet || "" : "";
  if (mentioned && !snippet) {
    const lines = text.split(/(?<=[.!?])\s+|\n/);
    snippet = lines.find((l) => matches(l, aa)) || "";
  }
  const score = !mentioned
    ? 0
    : Math.min(
        100,
        weights.mention +
          (pos === null
            ? weights.unordered
            : (weights.positions[pos - 1] ?? weights.lower)) +
          (urls.length ? weights.citation : 0) +
          weights.sentiment[sentiment],
      );
  return {
    mentioned,
    ambiguous: isAmbiguous,
    position: pos,
    totalEntities: es.length,
    cited: urls.length > 0,
    citationUrls: urls,
    sentiment,
    snippet,
    competitors: es.filter((e) => !matches(e.name, aa)),
    score,
  };
}
export function summarize(runs: { status: string; analysis?: Analysis }[]) {
  const ok = runs.filter((r) => r.status === "ok" && r.analysis);
  const score = ok.length
    ? Math.round(ok.reduce((n, r) => n + r.analysis!.score, 0) / ok.length)
    : null;
  return {
    score,
    label:
      score === null
        ? "Unavailable"
        : score >= 70
          ? "Strong"
          : score >= 40
            ? "Moderate"
            : score > 0
              ? "Weak"
              : "Not visible",
    visible: ok.filter((r) => r.analysis!.mentioned).length,
    total: ok.length,
    unavailable: runs.length - ok.length,
  };
}
