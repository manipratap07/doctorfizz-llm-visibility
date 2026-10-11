export const runtime = "nodejs";
export const maxDuration = 180;
import { relay } from "@/lib/backend";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { body, error } from "@/lib/http";
import { leadSchema } from "@/lib/schemas";
import { visitor } from "@/lib/identity";
import { rateLimit } from "@/lib/limits";
import { db } from "@/lib/db";
import { leads } from "@/lib/schema";
export async function POST(req: Request) {
  const forwarded = await relay(req);
  if (forwarded) return forwarded;
  try {
    const d = leadSchema.parse(await body(req));
    await rateLimit("leads", 3);
    await db.insert(leads).values({
      id: randomUUID(),
      visitorId: await visitor(),
      name: d.name,
      email: d.email,
      phone: d.phone,
    });
    return NextResponse.json({ saved: true });
  } catch (e) {
    return error(e);
  }
}
