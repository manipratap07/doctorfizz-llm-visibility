import { healthCheck } from "./health-run";
import { pool } from "../lib/db";
async function main() {
  try {
    const results = await healthCheck();
    for (const r of results)
      console.log(
        JSON.stringify({
          provider: r.provider,
          status: r.result.status,
          reason: r.result.errorReason,
          model: r.result.modelReported,
          webSearchUsed: r.result.webSearchUsed,
        }),
      );
    if (results.some((r) => r.result.status !== "ok")) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
