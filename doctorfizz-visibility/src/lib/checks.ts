import { randomUUID } from "node:crypto";
import { pool, query } from "./db";
import { providers } from "./providers.config";
import { providerQueue, deadlineQueue } from "./redis";
import { allowance } from "./limits";
import type { Brand, Run, Check } from "./types";
export async function createCheck(
  visitorId: string,
  ip: string,
  data: {
    profileId: string;
    promptId: string;
    providers: string[];
    idempotencyKey: string;
  },
) {
  const c = await pool.connect();
  let checkId = randomUUID(),
    existing = false;
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(841372)");
    const prior = await c.query(
      "SELECT id FROM checks WHERE visitor_id=$1 AND idempotency_key=$2",
      [visitorId, data.idempotencyKey],
    );
    if (prior.rows.length) {
      checkId = prior.rows[0].id;
      existing = true;
      await c.query("COMMIT");
      return { checkId, existing };
    }
    const row = (
      await c.query(
        "SELECT p.text,s.brand FROM generated_prompts p JOIN site_profiles s ON p.site_profile_id=s.id WHERE p.id=$1 AND s.id=$2 AND s.visitor_id=$3 AND p.active=true",
        [data.promptId, data.profileId, visitorId],
      )
    ).rows[0];
    if (!row) throw new Error("Select one of your generated prompts.");
    const selected = [...new Set(data.providers)].map((id) =>
      providers().find((p) => p.id === id && p.enabled),
    );
    if (selected.some((p) => !p))
      throw new Error("Unknown or disabled provider.");
    const repeats = Math.min(
      5,
      Math.max(1, Number(process.env.RUNS_PER_PROVIDER || 1)),
    );
    const cost =
      selected.reduce((n, p) => n + p!.costUsd * repeats * 2, 0) +
      Number(process.env.ANALYSIS_COST_CEILING_USD || 0) *
        selected.length *
        repeats;
    if (!Number.isFinite(repeats) || !Number.isInteger(repeats))
      throw new Error("RUNS_PER_PROVIDER must be an integer from 1 to 5.");
    if (
      !Number.isFinite(cost) ||
      !Number.isFinite(Number(process.env.DAILY_BUDGET_USD)) ||
      selected.some((p) => p!.key && (!p!.costUsd || p!.costUsd <= 0)) ||
      !Number(process.env.DAILY_BUDGET_USD) ||
      Number(process.env.ANALYSIS_COST_CEILING_USD || 0) <= 0
    )
      throw new Error(
        "Provider cost ceilings and the daily budget must be configured before live checks.",
      );
    const stats = (
      await c.query(
        `SELECT count(*) FILTER (WHERE (visitor_id=$1 OR ip_hash=$2) AND NOT refunded AND created_at>now()-($4*interval '1 day')) visitor_count,count(*) FILTER (WHERE ip_hash=$2 AND created_at>date_trunc('day',now())) ip_count,count(*) FILTER (WHERE domain=$3 AND created_at>date_trunc('day',now())) domain_count,coalesce(sum(cost) FILTER (WHERE created_at>date_trunc('day',now())),0)+(SELECT coalesce(sum(cost),0) FROM intelligence_cost_events WHERE created_at>=date_trunc('day',now())) budget FROM usage_events`,
        [
          visitorId,
          ip,
          (row.brand as Brand).domain,
          Number(process.env.WINDOW_DAYS || 30),
        ],
      )
    ).rows[0];
    if (Number(stats.visitor_count) >= allowance())
      throw new Error("Your five free checks have been used.");
    if (
      Number(stats.ip_count) >= Number(process.env.IP_DAILY_CAP || 15) ||
      Number(stats.domain_count) >= Number(process.env.DOMAIN_DAILY_CAP || 10)
    )
      throw new Error("The daily check limit has been reached.");
    if (Number(stats.budget) + cost > Number(process.env.DAILY_BUDGET_USD))
      throw new Error("High demand, please try again later.");
    await c.query(
      "INSERT INTO checks(id,visitor_id,site_profile_id,prompt_id,prompt_text,brand,selected_providers,estimated_cost,deadline_at,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '120 seconds',$9)",
      [
        checkId,
        visitorId,
        data.profileId,
        data.promptId,
        row.text,
        row.brand,
        JSON.stringify(data.providers),
        cost,
        data.idempotencyKey,
      ],
    );
    for (const p of selected)
      for (let i = 0; i < repeats; i++)
        await c.query(
          "INSERT INTO llm_runs(id,check_id,provider_id,repeat_index) VALUES($1,$2,$3,$4)",
          [randomUUID(), checkId, p!.id, i],
        );
    await c.query(
      "INSERT INTO usage_events(id,visitor_id,check_id,ip_hash,domain,cost) VALUES($1,$2,$3,$4,$5,$6)",
      [randomUUID(), visitorId, checkId, ip, (row.brand as Brand).domain, cost],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
  // Database rows are the durable outbox; worker reconciliation repairs queue interruptions.
  try {
    await enqueue(checkId);
  } catch {
    console.error(JSON.stringify({ event: "enqueue_deferred", checkId }));
  }
  return { checkId, existing };
}
export async function enqueue(id: string) {
  const rows = await query<{
    id: string;
    provider_id: string;
    repeat_index: number;
  }>(
    "SELECT id,provider_id,repeat_index FROM llm_runs WHERE check_id=$1 AND status='queued'",
    [id],
  );
  for (const r of rows) {
    const q = providerQueue(r.provider_id);
    try {
      await q.add(
        "run",
        { runId: r.id, checkId: id, repeat_index: r.repeat_index },
        {
          jobId: r.id,
          attempts: 2,
          backoff: { type: "exponential", delay: 1500 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        },
      );
    } finally {
      await q.close();
    }
  }
  const q = deadlineQueue();
  try {
    await q.add(
      "finalize",
      { checkId: id },
      { jobId: id, delay: 120000, removeOnComplete: 1000 },
    );
  } finally {
    await q.close();
  }
}
export async function getCheck(id: string): Promise<Check | null> {
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  const [row] = await query<Check & { deadline_at: string }>(
    "SELECT id,brand,prompt_text,status,created_at,refunded,deadline_at FROM checks WHERE id=$1 AND created_at>now()-interval '7 days'",
    [id],
  );
  if (!row) return null;
  if (
    row.status !== "completed" &&
    new Date(row.deadline_at).getTime() <= Date.now()
  ) {
    await finish(id, true);
    return getCheck(id);
  }
  const { deadline_at: _, ...check } = row;
  check.runs = await query<Run>(
    "SELECT * FROM llm_runs WHERE check_id=$1 ORDER BY provider_id,repeat_index",
    [id],
  );
  return check;
}
export async function finish(id: string, force = false) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const check = (
      await c.query("SELECT * FROM checks WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (!check || check.status === "completed") {
      await c.query("COMMIT");
      return;
    }
    if (force)
      await c.query(
        "UPDATE llm_runs SET status='timeout',reason='Overall check deadline exceeded.',completed_at=now() WHERE check_id=$1 AND status IN ('queued','running')",
        [id],
      );
    const rows = (
      await c.query("SELECT status FROM llm_runs WHERE check_id=$1", [id])
    ).rows;
    if (rows.some((r) => ["queued", "running"].includes(r.status))) {
      await c.query("COMMIT");
      return;
    }
    const refund = rows.every((r) => r.status !== "ok");
    await c.query(
      "UPDATE checks SET status='completed',refunded=$2 WHERE id=$1",
      [id, refund],
    );
    if (refund)
      await c.query("UPDATE usage_events SET refunded=true WHERE check_id=$1", [
        id,
      ]);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
