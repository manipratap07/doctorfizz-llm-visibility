import { cookies, headers } from "next/headers";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { query } from "./db";
function salt() {
  const s = process.env.IP_HASH_SALT;
  if (!s || s.length < 32)
    throw new Error("IP_HASH_SALT must have at least 32 characters.");
  return s;
}
export const digest = (s: string) =>
  createHmac("sha256", salt()).update(s).digest("hex");
export async function visitor(create = true) {
  const jar = await cookies();
  const value = jar.get("df_visitor")?.value;
  let id: string | undefined;
  if (value) {
    const [candidate, signature] = value.split(".");
    if (/^[a-f0-9-]{36}$/.test(candidate) && signature?.length === 64) {
      const actual = digest(candidate);
      if (timingSafeEqual(Buffer.from(actual), Buffer.from(signature)))
        id = candidate;
    }
  }
  if (!id) {
    if (!create) throw new Error("Visitor session required.");
    id = randomUUID();
    jar.set("df_visitor", id + "." + digest(id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400 * Number(process.env.WINDOW_DAYS || 30),
    });
  }
  await query("INSERT INTO visitors(id) VALUES($1) ON CONFLICT DO NOTHING", [
    id,
  ]);
  return id;
}
export async function ipHash() {
  const h = await headers();
  const trusted = process.env.TRUSTED_IP_HEADER;
  const ip = trusted ? h.get(trusted)?.split(",")[0]?.trim() : null;
  if (process.env.NODE_ENV === "production" && !ip)
    throw new Error("Trusted proxy IP header is not configured.");
  return digest(ip || "local-development");
}
export async function sameOrigin() {
  const h = await headers();
  const o = h.get("origin");
  const app = process.env.APP_URL;
  if (!app) throw new Error("APP_URL is required.");
  if (h.get("sec-fetch-site") === "cross-site")
    throw new Error("Origin is not allowed.");
  if (o && new URL(o).origin !== new URL(app).origin)
    throw new Error("Origin is not allowed.");
}
