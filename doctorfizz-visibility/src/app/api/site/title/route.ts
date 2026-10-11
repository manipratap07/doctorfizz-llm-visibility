export const runtime = "nodejs";
export const maxDuration = 180;
import { relay } from "@/lib/backend";
import { NextResponse } from "next/server";
import { z } from "zod";
import { load } from "cheerio";
import { body, error } from "@/lib/http";
import { rateLimit } from "@/lib/limits";
import { safeFetch } from "@/lib/security";
export async function POST(req: Request) {
  const forwarded = await relay(req);
  if (forwarded) return forwarded;
  try {
    const d = z
      .object({ url: z.string().min(3).max(2048) })
      .parse(await body(req));
    await rateLimit("title", 6);
    const site = await safeFetch(d.url);
    const $ = load(site.html);
    let name =
      $('meta[property="og:site_name"]').attr("content") ||
      $("title").text().split(/[|–—]/)[0];
    return NextResponse.json({ name: name.trim().slice(0, 100) });
  } catch (e) {
    return error(e);
  }
}
