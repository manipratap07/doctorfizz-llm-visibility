import { providers } from "../lib/providers.config";
import { getAdapter } from "../lib/provider-adapters";
import { reserveCost } from "../lib/budget";
export async function healthCheck() {
  const enabled = providers().filter((p) => p.enabled);
  const billable = enabled.filter(
    (p) => p.adapter === "api" && p.key && p.modelId && p.url,
  );
  if (billable.some((p) => !Number.isFinite(p.costUsd) || p.costUsd <= 0))
    throw new Error("Set provider request cost ceilings before health checks.");
  const cost = billable.reduce((n, p) => n + p.costUsd, 0);
  if (cost) await reserveCost(cost);
  return Promise.all(
    enabled.map(async (p) => ({
      provider: p.id,
      result: await getAdapter(p.id).run({
        prompt:
          "What are the best project management tools for a small team? Give a ranked list.",
        signal: AbortSignal.timeout(p.timeoutMs),
      }),
    })),
  );
}
