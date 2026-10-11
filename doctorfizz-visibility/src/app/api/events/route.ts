export const runtime = "nodejs";
export const maxDuration = 180;
import { relay } from "@/lib/backend";
import { NextResponse } from "next/server";
import { z } from "zod";
import pino from "pino";
import { body, error } from "@/lib/http";
import { rateLimit } from "@/lib/limits";
const event = z.object({
  event: z.enum([
    "site_analyzed",
    "prompt_selected",
    "check_started",
    "check_completed",
    "limit_reached",
    "lead_submitted",
  ]),
});
const log = pino();
export async function POST(req: Request) {
  const forwarded = await relay(req);
  if (forwarded) return forwarded;
  try {
    const data = event.parse(await body(req));
    await rateLimit("events", 60);
    log.info({ event: data.event, source: "tool_interaction" });
    return NextResponse.json({ received: true });
  } catch (e) {
    return error(e);
  }
}
