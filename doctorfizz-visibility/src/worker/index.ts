import { Worker } from "bullmq";
import { createHash } from "node:crypto";
import pino from "pino";
import { providers } from "../lib/providers.config";
import { redis, providerQueue } from "../lib/redis";
import { query, pool } from "../lib/db";
import { getAdapter } from "../lib/provider-adapters";
import { analyze } from "../lib/analysis";
import { extract } from "../lib/intelligence";
import { finish, enqueue } from "../lib/checks";
import type { ProviderResult, Brand } from "../lib/types";
import { healthCheck } from "./health-run";
const log = pino({ redact: ["key", "token", "ip"] });
const workers: Worker[] = [];
async function startup() {
  for (const p of providers().filter((p) => p.enabled)) {
    const q = providerQueue(p.id);
    await q.setGlobalConcurrency(p.maxConcurrency);
    await q.close();
    const worker = new Worker(
      "provider-" + p.id,
      async (job) => {
        const [row] = await query<{
          prompt_text: string;
          brand: Brand;
          deadline_at: string;
          status: string;
        }>(
          "SELECT c.prompt_text,c.brand,c.deadline_at,r.status FROM checks c JOIN llm_runs r ON r.check_id=c.id WHERE r.id=$1",
          [job.data.runId],
        );
        if (!row || !["queued", "running"].includes(row.status)) return;
        const remaining = new Date(row.deadline_at).getTime() - Date.now();
        if (remaining <= 0) {
          await finish(job.data.checkId, true);
          return;
        }
        await query(
          "UPDATE llm_runs SET status='running' WHERE id=$1 AND status='queued'",
          [job.data.runId],
        );
        const key = createHash("sha256")
          .update(
            JSON.stringify([
              row.prompt_text,
              p.id,
              p.modelId,
              p.webSearch,
              job.data.repeat_index || 0,
            ]),
          )
          .digest("hex");
        const [cached] = await query<{
          result: ProviderResult;
          created_at: string;
        }>(
          "SELECT result,created_at FROM response_cache WHERE key=$1 AND expires_at>now()",
          [key],
        );
        let result: ProviderResult;
        if (cached) result = cached.result;
        else {
          result = await getAdapter(p.id).run({
            prompt: row.prompt_text,
            signal: AbortSignal.timeout(Math.min(p.timeoutMs, remaining)),
          });
          if (
            (result.status === "rate_limited" ||
              /HTTP 5\d\d/.test(result.errorReason || "")) &&
            job.attemptsMade === 0
          )
            throw new Error("Retryable provider failure");
          if (result.status === "ok")
            await query(
              "INSERT INTO response_cache(key,result,expires_at) VALUES($1,$2,now()+($3*interval '1 hour')) ON CONFLICT(key) DO UPDATE SET result=$2,created_at=now(),expires_at=EXCLUDED.expires_at",
              [key, result, Number(process.env.CACHE_TTL_HOURS || 6)],
            );
        }
        const analysis =
          result.status === "ok"
            ? analyze(
                result.answerText!,
                result.citations || [],
                row.brand,
                await extract(result.answerText!),
              )
            : null;
        await query(
          "UPDATE llm_runs SET status=$2,reason=$3,answer_text=$4,citations=$5,model_reported=$6,web_search_used=$7,latency_ms=$8,from_cache=$9,cache_created_at=$10,analysis=$11,completed_at=now() WHERE id=$1 AND status IN ('queued','running')",
          [
            job.data.runId,
            result.status,
            result.errorReason || null,
            result.answerText || null,
            JSON.stringify(result.citations || []),
            result.modelReported || null,
            result.webSearchUsed,
            result.latencyMs,
            !!cached,
            cached?.created_at || null,
            analysis,
          ],
        );
        log.info({
          event: "provider_completed",
          provider: p.id,
          status: result.status,
          checkId: job.data.checkId,
          latencyMs: result.latencyMs,
        });
        await finish(job.data.checkId);
      },
      { connection: redis(), concurrency: p.maxConcurrency },
    );
    worker.on("failed", async (job, error) => {
      log.error({
        event: "provider_job_failed",
        provider: p.id,
        message: error.message,
      });
      if (job && job.attemptsMade >= 2) {
        await query(
          "UPDATE llm_runs SET status='error',reason='Provider failed after retry.',completed_at=now() WHERE id=$1 AND status IN ('queued','running')",
          [job.data.runId],
        );
        await finish(job.data.checkId);
      }
    });
    workers.push(worker);
  }
  const deadline = new Worker(
    "deadlines",
    async (job) => {
      await finish(job.data.checkId, true);
    },
    { connection: redis(), concurrency: 10 },
  );
  workers.push(deadline);
  let reconciling = false;
  const reconcile = async () => {
    if (reconciling) return;
    reconciling = true;
    try {
      const old = await query<{ id: string }>(
        "SELECT id FROM checks WHERE status!='completed' AND deadline_at<now()",
      );
      for (const c of old) await finish(c.id, true);
      const pending = await query<{ id: string }>(
        "SELECT DISTINCT c.id FROM checks c JOIN llm_runs r ON r.check_id=c.id WHERE c.status!='completed' AND c.deadline_at>now() AND r.status='queued'",
      );
      for (const c of pending) await enqueue(c.id);
      await query(
        "DELETE FROM intelligence_cost_events WHERE created_at<now()-interval '31 days'",
      );
      await query("DELETE FROM response_cache WHERE expires_at<now()");
      await query(
        "DELETE FROM usage_events WHERE created_at<now()-(($1+1)*interval '1 day')",
        [Number(process.env.WINDOW_DAYS || 30)],
      );
      await query(
        "DELETE FROM checks WHERE created_at<now()-interval '7 days'",
      );
      await query(
        "DELETE FROM generated_prompts WHERE site_profile_id IN (SELECT s.id FROM site_profiles s WHERE s.created_at<now()-interval '31 days' AND NOT EXISTS (SELECT 1 FROM checks c WHERE c.site_profile_id=s.id))",
      );
      await query(
        "DELETE FROM site_profiles s WHERE created_at<now()-interval '31 days' AND NOT EXISTS (SELECT 1 FROM checks c WHERE c.site_profile_id=s.id)",
      );
      await query(
        "DELETE FROM leads WHERE consent_at<now()-interval '90 days'",
      );
      await query(
        "DELETE FROM visitors v WHERE created_at<now()-interval '90 days' AND NOT EXISTS(SELECT 1 FROM leads l WHERE l.visitor_id=v.id) AND NOT EXISTS(SELECT 1 FROM site_profiles s WHERE s.visitor_id=v.id) AND NOT EXISTS(SELECT 1 FROM usage_events u WHERE u.visitor_id=v.id)",
      );
    } catch (e) {
      log.error({ event: "reconcile_failed", message: (e as Error).message });
    } finally {
      reconciling = false;
    }
  };
  await reconcile();
  const timer = setInterval(reconcile, 10000);
  const healthTimer =
    process.env.HEALTH_CHECK_ENABLED === "true"
      ? setInterval(async () => {
          try {
            const results = await healthCheck();
            for (const r of results)
              log[r.result.status === "ok" ? "info" : "error"]({
                event:
                  r.result.status === "ok"
                    ? "adapter_health_ok"
                    : "adapter_health_alert",
                provider: r.provider,
                status: r.result.status,
                reason: r.result.errorReason,
              });
          } catch (e) {
            log.error({
              event: "adapter_health_alert",
              message: (e as Error).message,
            });
          }
        }, 86400000)
      : undefined;
  log.info({ event: "worker_ready" });
  for (const sig of ["SIGTERM", "SIGINT"])
    process.on(sig, async () => {
      clearInterval(timer);
      if (healthTimer) clearInterval(healthTimer);
      await Promise.all(workers.map((w) => w.close()));
      await pool.end();
      await redis().quit();
      process.exit(0);
    });
}
startup().catch((e) => {
  log.error({ event: "startup_failed", message: e.message });
  process.exit(1);
});
