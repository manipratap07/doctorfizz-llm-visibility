import { redis } from "./redis";
import { query } from "./db";
import { ipHash } from "./identity";
export const allowance = () => Number(process.env.FREE_ATTEMPTS || 5);
export async function usage(id: string, ip?: string) {
  const hash = ip || (await ipHash());
  const [row] = await query<{ n: string }>(
    "SELECT count(*) n FROM usage_events WHERE (visitor_id=$1 OR ip_hash=$3) AND NOT refunded AND created_at>now()-($2*interval '1 day')",
    [id, Number(process.env.WINDOW_DAYS || 30), hash],
  );
  return Math.max(0, allowance() - Number(row.n));
}
export async function rateLimit(key: string, max = 30) {
  const ip = await ipHash();
  const n = await redis().eval(
    "local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],60) end;return n",
    1,
    "rate:" + key + ":" + ip,
  );
  if (Number(n) > max)
    throw new Error("Too many requests. Please wait one minute.");
}
export async function verifyTurnstile(token: string) {
  if (
    process.env.NODE_ENV === "development" &&
    process.env.DEV_BYPASS_TURNSTILE === "true"
  )
    return;
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error("Bot verification is not configured.");
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(8000),
    },
  );
  const j = await res.json();
  if (
    !j.success ||
    j.action !== "visibility" ||
    (process.env.TURNSTILE_HOSTNAME &&
      j.hostname !== process.env.TURNSTILE_HOSTNAME)
  )
    throw new Error("Complete the verification and try again.");
}
