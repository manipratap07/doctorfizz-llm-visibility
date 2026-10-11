export const runtime = "nodejs";
export const maxDuration = 180;
import { relay } from "@/lib/backend";
import { NextResponse } from "next/server";
import { visitor } from "@/lib/identity";
import { rateLimit, usage, allowance } from "@/lib/limits";
import { error } from "@/lib/http";
export async function GET(req: Request) {
  const forwarded = await relay(req);
  if (forwarded) return forwarded;
  try {
    await rateLimit("usage", 60);
    const id = await visitor();
    return NextResponse.json(
      {
        attemptsLeft: await usage(id),
        total: allowance(),
        windowDays: Number(process.env.WINDOW_DAYS || 30),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return error(e);
  }
}
