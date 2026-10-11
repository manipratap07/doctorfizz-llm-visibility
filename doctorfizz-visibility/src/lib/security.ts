import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { Agent, request } from "undici";
export function publicIp(ip: string) {
  try {
    return ipaddr.process(ip).range() === "unicast";
  } catch {
    return false;
  }
}
export function validateUrl(raw: string) {
  const u = new URL(
    /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : "https://" + raw,
  );
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    !["", "80", "443"].includes(u.port)
  )
    throw new Error("Use a public HTTP or HTTPS website without credentials.");
  return u;
}
export async function safeFetch(raw: string) {
  let u = validateUrl(raw);
  const signal = AbortSignal.timeout(5000);
  for (let i = 0; i <= 3; i++) {
    const host = u.hostname.replace(/^\[|\]$/g, "");
    signal.throwIfAborted();
    const records = await new Promise<{ address: string; family: number }[]>(
      (resolve, reject) => {
        const abort = () =>
          reject(new Error("Website lookup exceeded the time limit."));
        signal.addEventListener("abort", abort, { once: true });
        lookup(host, { all: true })
          .then(resolve, reject)
          .finally(() => signal.removeEventListener("abort", abort));
      },
    );
    if (!records.length || records.some((r) => !publicIp(r.address)))
      throw new Error("This address is not a public website.");
    const pinned = records[0];
    const dispatcher = new Agent({
      connect: {
        lookup: (_hostname, _options, cb) =>
          cb(null, pinned.address, pinned.family),
      },
    });
    try {
      const r = await request(u, {
        method: "GET",
        dispatcher,
        signal,
        headers: {
          "user-agent": "DoctorFizzVisibility/1.0",
          accept: "text/html",
        },
      });
      if (r.statusCode >= 300 && r.statusCode < 400) {
        await r.body.dump();
        if (i === 3) throw new Error("Too many redirects.");
        u = validateUrl(new URL(String(r.headers.location), u).href);
        continue;
      }
      if (r.statusCode >= 400)
        throw new Error("Website returned HTTP " + r.statusCode);
      if (!String(r.headers["content-type"]).includes("text/html"))
        throw new Error("Website did not return HTML.");
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const part of r.body) {
        const buf = Buffer.from(part);
        size += buf.length;
        if (size > 1024 * 1024) {
          r.body.destroy();
          throw new Error("Website response exceeds 1 MB.");
        }
        chunks.push(buf);
      }
      return { html: Buffer.concat(chunks).toString("utf8"), url: u.href };
    } finally {
      await dispatcher.close();
    }
  }
  throw new Error("Website fetch failed.");
}
