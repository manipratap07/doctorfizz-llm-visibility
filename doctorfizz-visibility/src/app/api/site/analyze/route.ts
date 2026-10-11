export const maxDuration = 180;
import { relay } from "@/lib/backend";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { body, error } from "@/lib/http";
import { analyzeSchema } from "@/lib/schemas";
import { visitor } from "@/lib/identity";
import { rateLimit } from "@/lib/limits";
import { safeFetch, validateUrl } from "@/lib/security";
import { classify, generate } from "@/lib/intelligence";
import { query } from "@/lib/db";
import { reserveIntelligenceCost } from "@/lib/budget";
import type { SiteProfile } from "@/lib/types";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const forwarded = await relay(req);
  if (forwarded) return forwarded;
  try {
    const data = analyzeSchema.parse(await body(req));
    await rateLimit("analyze", 6);
    const id = await visitor();
    const u = validateUrl(data.url);
    const brand = {
      name: data.name,
      aliases: data.aliases,
      domain: u.hostname.replace(/^www\./, ""),
    };
    let profile: SiteProfile | undefined;
    let note = "";
    await reserveIntelligenceCost(data.category ? 2 : 3);
    try {
      if (!data.category) {
        const site = await safeFetch(u.href);
        profile = await classify(site.html, data.location);
      }
    } catch {
      note =
        "We could not confidently classify this website. Enter its category to continue.";
    }
    if (data.category)
      profile = {
        category: data.category,
        subCategory: "",
        primaryOffering: data.category,
        targetAudience: "businesses and customers",
        isLocalBusiness: !!data.location,
        location: data.location,
        language: "English",
        confidence: 0.5,
      };
    if (!profile || profile.confidence < 0.5)
      return NextResponse.json({ needsCategory: true, note, brand });
    if (data.location) profile.location = data.location;
    const prompts = await generate(profile, brand);
    const profileId = randomUUID();
    await query(
      "INSERT INTO site_profiles(id,visitor_id,brand,profile) VALUES($1,$2,$3,$4)",
      [profileId, id, brand, profile],
    );
    for (const p of prompts)
      await query(
        "INSERT INTO generated_prompts(id,site_profile_id,type,text) VALUES($1,$2,$3,$4)",
        [p.id, profileId, p.type, p.text],
      );
    return NextResponse.json({
      profileId,
      profile,
      prompts,
      brand,
      note,
      languageNote:
        profile.language.toLowerCase() !== "english"
          ? "This website uses " +
            profile.language +
            ". Version 1 prompts are English."
          : null,
    });
  } catch (e) {
    return error(e);
  }
}
