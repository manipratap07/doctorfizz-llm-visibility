import { isIP } from "node:net";
import { getPublicProviders } from "./providers.config";

function backend() {
  if (!process.env.BACKEND_URL) return null;
  const url = new URL(process.env.BACKEND_URL);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("BACKEND_URL must be an origin without a path.");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    throw new Error("BACKEND_URL must use HTTPS.");
  if (
    !process.env.BACKEND_SHARED_SECRET ||
    process.env.BACKEND_SHARED_SECRET.length < 32
  )
    throw new Error("Backend authentication is not configured.");
  return url;
}

/** Same-origin browser API, relayed only to the operator's fixed HTTPS backend. */
export async function relay(req: Request): Promise<Response | null> {
  if (!process.env.BACKEND_URL) return null;
  try {
    const target = backend()!;
    const incoming = new URL(req.url);
    target.pathname = incoming.pathname;
    target.search = incoming.search;
    const headers = new Headers({
      "x-doctorfizz-backend-key": process.env.BACKEND_SHARED_SECRET!,
    });
    for (const name of [
      "cookie",
      "content-type",
      "origin",
      "sec-fetch-site",
      "accept",
    ]) {
      const value = req.headers.get(name);
      if (value) headers.set(name, value);
    }
    // Vercel overwrites this header. Never use a browser-supplied custom IP header.
    const ip =
      process.env.VERCEL === "1"
        ? req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
        : process.env.NODE_ENV !== "production"
          ? "127.0.0.1"
          : null;
    if (!ip || !isIP(ip))
      throw new Error("Trusted frontend IP is unavailable.");
    headers.set("x-doctorfizz-proxy-ip", ip);
    let body: string | undefined;
    if (!["GET", "HEAD"].includes(req.method)) {
      if (Number(req.headers.get("content-length") || 0) > 16384)
        return Response.json({ error: "Request too large." }, { status: 413 });
      body = await req.text();
      if (Buffer.byteLength(body) > 16384)
        return Response.json({ error: "Request too large." }, { status: 413 });
    }
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(165000)]),
    });
    const out = new Headers({ "Cache-Control": "no-store" });
    for (const name of [
      "content-type",
      "content-disposition",
      "x-accel-buffering",
    ])
      if (upstream.headers.has(name))
        out.set(name, upstream.headers.get(name)!);
    for (const cookie of upstream.headers.getSetCookie())
      out.append("set-cookie", cookie);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: out,
    });
  } catch {
    return Response.json(
      { error: "The check service is unavailable. Please try again shortly." },
      { status: 503 },
    );
  }
}

export async function getToolConfig() {
  const target = backend();
  if (target) {
    target.pathname = "/api/config";
    const r = await fetch(target, {
      headers: {
        "x-doctorfizz-backend-key": process.env.BACKEND_SHARED_SECRET!,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (!r.ok)
      throw new Error("The check service configuration is unavailable.");
    return (await r.json()) as {
      providers: ReturnType<typeof getPublicProviders>;
      turnstileKey: string;
    };
  }
  return {
    providers: getPublicProviders(),
    turnstileKey:
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
      process.env.TURNSTILE_SITE_KEY ||
      "",
  };
}
