export const runtime = "nodejs";
export const maxDuration = 180;
import { relay } from "@/lib/backend";
import { NextResponse } from "next/server";
import { body, error } from "@/lib/http";
import { checkSchema } from "@/lib/schemas";
import { visitor, ipHash } from "@/lib/identity";
import { rateLimit, verifyTurnstile, usage } from "@/lib/limits";
import { createCheck } from "@/lib/checks";
export async function POST(req: Request) {
  const forwarded = await relay(req);
  if (forwarded) return forwarded;
  try {
    const d = checkSchema.parse(await body(req));
    await rateLimit("checks", 10);
    const id = await visitor(false);
    await verifyTurnstile(d.turnstileToken);
    const result = await createCheck(id, await ipHash(), d);
    return NextResponse.json({ ...result, attemptsLeft: await usage(id) });
  } catch (e) {
    return error(e);
  }
}
