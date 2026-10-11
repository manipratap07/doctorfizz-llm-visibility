export const runtime = "nodejs";
export const maxDuration = 180;
import { relay } from "@/lib/backend";
import { NextResponse } from "next/server";
import { body, error } from "@/lib/http";
import { visitor } from "@/lib/identity";
import { rateLimit } from "@/lib/limits";
import { pool } from "@/lib/db";
export async function POST(req: Request) {
  const forwarded = await relay(req);
  if (forwarded) return forwarded;
  try {
    await body(req);
    await rateLimit("delete", 3);
    const id = await visitor(false);
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("DELETE FROM leads WHERE visitor_id=$1", [id]);
      /* Abuse-control events remain hashed until their 31-day expiry; delete public evidence and profile content. */ await c.query(
        "UPDATE checks SET brand='{}',prompt_text='Data deleted',status='completed' WHERE visitor_id=$1",
        [id],
      );
      await c.query(
        "DELETE FROM llm_runs WHERE check_id IN (SELECT id FROM checks WHERE visitor_id=$1)",
        [id],
      );
      await c.query(
        "UPDATE site_profiles SET brand='{}',profile='{}' WHERE visitor_id=$1",
        [id],
      );
      await c.query(
        "UPDATE generated_prompts SET text='Data deleted' WHERE site_profile_id IN (SELECT id FROM site_profiles WHERE visitor_id=$1)",
        [id],
      );
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return error(e);
  }
}
