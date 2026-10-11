export const runtime = "nodejs";
export const maxDuration = 180;
import { relay } from "@/lib/backend";
import { NextResponse } from "next/server";
import { z } from "zod";
import { body, error } from "@/lib/http";
import { profileSchema } from "@/lib/schemas";
import { visitor } from "@/lib/identity";
import { rateLimit } from "@/lib/limits";
import { query, pool } from "@/lib/db";
import { generate } from "@/lib/intelligence";
import { reserveIntelligenceCost } from "@/lib/budget";
import type { Brand } from "@/lib/types";
export async function POST(req: Request) {
  const forwarded = await relay(req);
  if (forwarded) return forwarded;
  try {
    const d = z
      .object({ profileId: z.uuid(), profile: profileSchema })
      .parse(await body(req));
    await rateLimit("regenerate", 6);
    const id = await visitor(false);
    const [s] = await query<{ brand: Brand }>(
      "SELECT brand FROM site_profiles WHERE id=$1 AND visitor_id=$2",
      [d.profileId, id],
    );
    if (!s) throw new Error("Site profile was not found.");
    await reserveIntelligenceCost(2);
    const prompts = await generate(d.profile, s.brand);
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("UPDATE site_profiles SET profile=$1 WHERE id=$2", [
        d.profile,
        d.profileId,
      ]);
      await c.query(
        "UPDATE generated_prompts SET active=false WHERE site_profile_id=$1",
        [d.profileId],
      );
      for (const p of prompts)
        await c.query(
          "INSERT INTO generated_prompts(id,site_profile_id,type,text) VALUES($1,$2,$3,$4)",
          [p.id, d.profileId, p.type, p.text],
        );
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
    return NextResponse.json({ prompts, profile: d.profile });
  } catch (e) {
    return error(e);
  }
}
