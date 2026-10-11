export const runtime = "nodejs";
export const maxDuration = 180;
import { relay } from "@/lib/backend";
import { NextResponse } from "next/server";
import { getCheck, finish } from "@/lib/checks";
import { error } from "@/lib/http";
import { rateLimit } from "@/lib/limits";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const forwarded = await relay(req);
  if (forwarded) return forwarded;
  try {
    await rateLimit("state", 120);
    const { id } = await params;
    const c = await getCheck(id);
    if (!c)
      return NextResponse.json(
        { error: "Check not found or expired." },
        { status: 404 },
      );
    return NextResponse.json(c, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return error(e);
  }
}
