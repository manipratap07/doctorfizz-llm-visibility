import { randomUUID } from "node:crypto";
import type { Brand, Prompt, SiteProfile } from "./types";
import { aliases, matches } from "./analysis";
export const intents = [
  "Best options",
  "Solve a problem",
  "Compare options",
  "For your audience",
  "Trust and reviews",
];
export function validatePrompts(ps: Prompt[], b: Brand) {
  return (
    ps.length === 5 &&
    new Set(ps.map((p) => p.text)).size === 5 &&
    ps.every((p) => {
      const n = p.text.trim().split(/\s+/).length;
      return (
        n >= 8 &&
        n <= 30 &&
        !matches(p.text, aliases(b)) &&
        !p.text.toLowerCase().includes(b.domain.toLowerCase())
      );
    })
  );
}
export function fallbackPrompts(profile: SiteProfile, b: Brand): Prompt[] {
  let c = profile.category,
    a = profile.targetAudience,
    l =
      profile.isLocalBusiness && profile.location
        ? " in " + profile.location
        : "";
  const clean = (s: string) =>
    matches(s, aliases(b)) ? "service providers" : s;
  c = clean(c);
  a = clean(a);
  l = clean(l) === "service providers" ? "" : l;
  const texts = [
    `What are the best ${c}${l}? Give me a ranked list of recommended options.`,
    `I need reliable ${c}${l}. Which providers would you recommend and why?`,
    `Compare the leading ${c}${l} options on pricing, features and reliability.`,
    `Which ${c}${l} would you recommend for ${a}, and why?`,
    `Which ${c}${l} are most trusted, with good customer reviews?`,
  ];
  const ps = texts.map((text, i) => ({
    id: randomUUID(),
    type: intents[i],
    text,
  }));
  if (!validatePrompts(ps, b))
    throw new Error(
      "Shorten the category, audience or location to generate five neutral prompts.",
    );
  return ps;
}
