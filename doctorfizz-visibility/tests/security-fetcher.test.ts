import { it, expect, vi, beforeEach } from "vitest";
const fakes = vi.hoisted(() => ({
  lookup: vi.fn(),
  request: vi.fn(),
  agents: [] as any[],
}));
vi.mock("node:dns/promises", () => ({ lookup: fakes.lookup }));
vi.mock("undici", () => ({
  Agent: class {
    constructor(options: unknown) {
      fakes.agents.push(options);
    }
    close = async () => {};
  },
  request: fakes.request,
}));
import { safeFetch } from "../src/lib/security";
const body = (chunks: Buffer[]) => ({
  dump: async () => {},
  destroy: vi.fn(),
  async *[Symbol.asyncIterator]() {
    for (const c of chunks) yield c;
  },
});
beforeEach(() => {
  fakes.lookup.mockReset();
  fakes.request.mockReset();
  fakes.agents.length = 0;
  fakes.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
});
it("blocks redirects to a private destination before issuing the second request", async () => {
  fakes.request.mockResolvedValue({
    statusCode: 302,
    headers: { location: "http://internal.example/" },
    body: body([]),
  });
  fakes.lookup
    .mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }])
    .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
  await expect(safeFetch("https://public.example")).rejects.toThrow(
    "not a public",
  );
  expect(fakes.request).toHaveBeenCalledTimes(1);
});
it("rejects a mixed public/private DNS response", async () => {
  fakes.lookup.mockResolvedValue([
    { address: "8.8.8.8", family: 4 },
    { address: "10.0.0.5", family: 4 },
  ]);
  await expect(safeFetch("https://public.example")).rejects.toThrow();
  expect(fakes.request).not.toHaveBeenCalled();
});
it("pins the validated DNS address and returns capped HTML", async () => {
  fakes.request.mockResolvedValue({
    statusCode: 200,
    headers: { "content-type": "text/html" },
    body: body([Buffer.from("<title>Brand</title>")]),
  });
  expect((await safeFetch("https://public.example")).html).toContain("Brand");
  const cb = vi.fn();
  fakes.agents[0].connect.lookup("public.example", {}, cb);
  expect(cb).toHaveBeenCalledWith(null, "8.8.8.8", 4);
});
it("rejects HTML over one MiB", async () => {
  fakes.request.mockResolvedValue({
    statusCode: 200,
    headers: { "content-type": "text/html" },
    body: body([Buffer.alloc(1024 * 1024 + 1)]),
  });
  await expect(safeFetch("https://public.example")).rejects.toThrow(
    "exceeds 1 MB",
  );
});
