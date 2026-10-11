import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

/** Optional VPS perimeter: all API requests must originate from our authenticated bridge. */
export function proxy(req: NextRequest) {
  if (process.env.BACKEND_AUTH_REQUIRED !== "true") return NextResponse.next();
  const expected = process.env.BACKEND_SHARED_SECRET || "";
  const supplied = req.headers.get("x-doctorfizz-backend-key") || "";
  if (
    expected.length < 32 ||
    Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
  )
    return NextResponse.json(
      { error: "Backend authentication required." },
      { status: 401 },
    );
  return NextResponse.next();
}
export const config = { matcher: "/api/:path*" };
