export const runtime = "nodejs";
export const maxDuration = 180;
import { relay } from "@/lib/backend";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { redis } from "@/lib/redis";
export async function GET(req: Request) {
  const forwarded = await relay(req);
  if (forwarded) return forwarded;
  try {
    await query("SELECT 1");
    await redis().ping();
    return NextResponse.json({ status: "ready" });
  } catch {
    return NextResponse.json({ status: "not_ready" }, { status: 503 });
  }
}
