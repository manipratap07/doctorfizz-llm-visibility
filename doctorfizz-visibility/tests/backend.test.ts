import { afterEach, describe, expect, it, vi } from "vitest";
import { relay } from "../src/lib/backend";
import { proxy } from "../src/proxy";
import { NextRequest } from "next/server";
const secret = "b".repeat(64);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function setup() {
  vi.stubEnv("BACKEND_URL", "https://backend.example.com");
  vi.stubEnv("BACKEND_SHARED_SECRET", secret);
  vi.stubEnv("VERCEL", "1");
}
describe("Vercel API bridge", () => {
  it("keeps browser cookies, CSV downloads and streams while replacing spoofed identity headers", async () => {
    setup();
    const fetcher = vi.fn().mockResolvedValue(
      new Response("provider progress", {
        headers: {
          "content-type": "text/event-stream",
          "set-cookie": "df_visitor=signed; Path=/; HttpOnly; Secure",
          "content-disposition": "attachment; filename=results.csv",
        },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const response = await relay(
      new Request("https://tool.example.com/api/checks/abc/stream", {
        headers: {
          cookie: "df_visitor=old",
          "x-vercel-forwarded-for": "8.8.8.8",
          "x-doctorfizz-proxy-ip": "1.1.1.1",
          "x-doctorfizz-backend-key": "spoofed",
        },
      }),
    );
    const [target, options] = fetcher.mock.calls[0];
    expect(target.href).toBe(
      "https://backend.example.com/api/checks/abc/stream",
    );
    expect(options.headers.get("x-doctorfizz-proxy-ip")).toBe("8.8.8.8");
    expect(options.headers.get("x-doctorfizz-backend-key")).toBe(secret);
    expect(options.headers.get("cookie")).toBe("df_visitor=old");
    expect(response!.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response!.headers.get("content-disposition")).toContain(
      "results.csv",
    );
    expect(response!.headers.get("cache-control")).toBe("no-store");
    expect(await response!.text()).toBe("provider progress");
  });
  it("fails closed when production identity is missing", async () => {
    setup();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const r = await relay(new Request("https://tool.example.com/api/usage"));
    expect(r!.status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects large payloads before any upstream call", async () => {
    setup();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const r = await relay(
      new Request("https://tool.example.com/api/checks", {
        method: "POST",
        headers: { "x-vercel-forwarded-for": "8.8.8.8" },
        body: "a".repeat(17000),
      }),
    );
    expect(r!.status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not relay in standalone VPS mode", async () => {
    vi.stubEnv("BACKEND_URL", "");
    expect(
      await relay(new Request("https://tool.example.com/api/usage")),
    ).toBeNull();
  });
});
describe("private VPS API perimeter", () => {
  it("rejects missing or invalid bridge secrets and accepts the correct one", () => {
    vi.stubEnv("BACKEND_AUTH_REQUIRED", "true");
    vi.stubEnv("BACKEND_SHARED_SECRET", secret);
    expect(
      proxy(new NextRequest("https://backend.example.com/api/usage")).status,
    ).toBe(401);
    expect(
      proxy(
        new NextRequest("https://backend.example.com/api/usage", {
          headers: { "x-doctorfizz-backend-key": "x".repeat(64) },
        }),
      ).status,
    ).toBe(401);
    expect(
      proxy(
        new NextRequest("https://backend.example.com/api/usage", {
          headers: { "x-doctorfizz-backend-key": secret },
        }),
      ).headers.get("x-middleware-next"),
    ).toBe("1");
  });
});
