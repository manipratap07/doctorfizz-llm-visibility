import { randomUUID } from "node:crypto";
import { pool } from "./db";
export async function reserveCost(amount: number) {
  const budget = Number(process.env.DAILY_BUDGET_USD || 0);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isFinite(budget) ||
    budget <= 0
  )
    throw new Error("Configure cost ceilings and the daily budget.");
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(841372)");
    const row = (
      await c.query(
        "SELECT (SELECT coalesce(sum(cost),0) FROM usage_events WHERE created_at>=date_trunc('day',now()))+(SELECT coalesce(sum(cost),0) FROM intelligence_cost_events WHERE created_at>=date_trunc('day',now())) AS used",
      )
    ).rows[0];
    if (Number(row.used) + amount > budget)
      throw new Error("High demand, please try again later.");
    await c.query(
      "INSERT INTO intelligence_cost_events(id,cost) VALUES($1,$2)",
      [randomUUID(), amount],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function reserveIntelligenceCost(calls: number) {
  if (!process.env.OPENAI_API_KEY || !process.env.EXTRACTOR_MODEL) return;
  await reserveCost(Number(process.env.ANALYSIS_COST_CEILING_USD || 0) * calls);
}
