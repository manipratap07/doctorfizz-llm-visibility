import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const state = vi.hoisted(() => ({ db: null as unknown as PGlite }));
vi.mock("../src/lib/db", () => {
  const query = async (sql: string, args: unknown[] = []) => {
    if (sql.includes("pg_advisory_xact_lock")) return [];
    return (await state.db.query(sql, args)).rows;
  };
  return {
    query,
    pool: {
      connect: async () => ({
        query: async (sql: string, args: unknown[] = []) => ({
          rows: await query(sql, args),
        }),
        release: () => {},
      }),
    },
  };
});
vi.mock("../src/lib/redis", () => ({
  providerQueue: () => ({ add: async () => {}, close: async () => {} }),
  deadlineQueue: () => ({ add: async () => {}, close: async () => {} }),
}));
import { createCheck, finish, getCheck } from "../src/lib/checks";
import { usage } from "../src/lib/limits";
const visitor = randomUUID(),
  profile = randomUUID(),
  prompt = randomUUID();
const input = () => ({
  profileId: profile,
  promptId: prompt,
  providers: ["openai", "deepseek"],
  idempotencyKey: randomUUID(),
});
beforeAll(async () => {
  state.db = new PGlite();
  await state.db.exec(readFileSync("db/001.sql", "utf8"));
  process.env.DAILY_BUDGET_USD = "100";
  process.env.ANALYSIS_COST_CEILING_USD = "0.02";
  await state.db.query("INSERT INTO visitors(id) VALUES($1)", [visitor]);
  await state.db.query(
    "INSERT INTO site_profiles(id,visitor_id,brand,profile) VALUES($1,$2,$3,$4)",
    [
      profile,
      visitor,
      JSON.stringify({ name: "Acme", domain: "acme.com", aliases: [] }),
      JSON.stringify({}),
    ],
  );
  await state.db.query(
    "INSERT INTO generated_prompts(id,site_profile_id,type,text) VALUES($1,$2,$3,$4)",
    [
      prompt,
      profile,
      "Best",
      "What are the best accounting software options for small business teams?",
    ],
  );
});
afterAll(async () => {
  await state.db.close();
});
it("creates durable runs, reuses idempotency and enforces ownership", async () => {
  const d = input();
  const a = await createCheck(visitor, "hash", d);
  const b = await createCheck(visitor, "hash", d);
  expect(a.checkId).toBe(b.checkId);
  expect((await getCheck(a.checkId))?.runs).toHaveLength(2);
  await expect(
    createCheck(visitor, "hash", { ...input(), promptId: randomUUID() }),
  ).rejects.toThrow("Select one");
  await state.db.query("UPDATE llm_runs SET status='error' WHERE check_id=$1", [
    a.checkId,
  ]);
  await finish(a.checkId);
  expect((await getCheck(a.checkId))?.refunded).toBe(true);
  expect(await usage(visitor, "hash")).toBe(5);
});
it("preserves successful partial results and times out pending jobs", async () => {
  const a = await createCheck(visitor, "hash", input());
  await state.db.query(
    "UPDATE llm_runs SET status='ok',answer_text='Evidence' WHERE check_id=$1 AND provider_id='openai'",
    [a.checkId],
  );
  await finish(a.checkId, true);
  const c = await getCheck(a.checkId);
  expect(c?.status).toBe("completed");
  expect(c?.refunded).toBe(false);
  expect(c?.runs.find((r) => r.provider_id === "deepseek")?.status).toBe(
    "timeout",
  );
});
it("limits five checks server-side and rejects the sixth", async () => {
  for (let i = 0; i < 4; i++) {
    const c = await createCheck(visitor, "hash", input());
    await state.db.query("UPDATE llm_runs SET status='ok' WHERE check_id=$1", [
      c.checkId,
    ]);
    await finish(c.checkId);
  }
  expect(await usage(visitor, "hash")).toBe(0);
  await expect(createCheck(visitor, "hash", input())).rejects.toThrow(
    "five free",
  );
});

it("does not reset allowance when a visitor cookie changes on the same IP", async () => {
  const other = randomUUID(),
    site = randomUUID(),
    question = randomUUID();
  await state.db.query("INSERT INTO visitors(id) VALUES($1)", [other]);
  await state.db.query(
    "INSERT INTO site_profiles(id,visitor_id,brand,profile) VALUES($1,$2,$3,$4)",
    [
      site,
      other,
      JSON.stringify({
        name: "Other Brand",
        domain: "other.example",
        aliases: [],
      }),
      JSON.stringify({}),
    ],
  );
  await state.db.query(
    "INSERT INTO generated_prompts(id,site_profile_id,type,text) VALUES($1,$2,$3,$4)",
    [
      question,
      site,
      "Best",
      "What are the best software providers for small business teams?",
    ],
  );
  expect(await usage(other, "hash")).toBe(0);
  await expect(
    createCheck(other, "hash", {
      profileId: site,
      promptId: question,
      providers: ["openai"],
      idempotencyKey: randomUUID(),
    }),
  ).rejects.toThrow("five free");
});
it("rejects stale prompts after category regeneration", async () => {
  await state.db.query(
    "UPDATE generated_prompts SET active=false WHERE id=$1",
    [prompt],
  );
  await expect(createCheck(visitor, "new-ip", input())).rejects.toThrow(
    "Select one",
  );
  await state.db.query("UPDATE generated_prompts SET active=true WHERE id=$1", [
    prompt,
  ]);
});

it("reserves classification cost in the same daily budget as provider checks", async () => {
  const { reserveCost } = await import("../src/lib/budget");
  await reserveCost(0.1);
  const count = (
    await state.db.query<{ n: string }>(
      "SELECT count(*) n FROM intelligence_cost_events",
    )
  ).rows[0].n;
  expect(Number(count)).toBe(1);
  const saved = process.env.DAILY_BUDGET_USD;
  process.env.DAILY_BUDGET_USD = "0.01";
  try {
    await expect(reserveCost(0.1)).rejects.toThrow("High demand");
  } finally {
    process.env.DAILY_BUDGET_USD = saved;
  }
  expect(
    Number(
      (
        await state.db.query<{ n: string }>(
          "SELECT count(*) n FROM intelligence_cost_events",
        )
      ).rows[0].n,
    ),
  ).toBe(1);
});
