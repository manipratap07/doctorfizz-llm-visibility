import { providers } from "../src/lib/providers.config";
const bridge = !!process.env.BACKEND_URL;
const required = bridge
  ? ["APP_URL", "BACKEND_URL", "BACKEND_SHARED_SECRET"]
  : [
      "APP_URL",
      "DATABASE_URL",
      "REDIS_URL",
      "IP_HASH_SALT",
      "TRUSTED_IP_HEADER",
      "TURNSTILE_SITE_KEY",
      "TURNSTILE_SECRET_KEY",
      "TURNSTILE_HOSTNAME",
      "DAILY_BUDGET_USD",
      "ANALYSIS_COST_CEILING_USD",
      "EXTRACTOR_MODEL",
    ];
let failed = false;
if (
  !bridge &&
  process.env.BACKEND_AUTH_REQUIRED === "true" &&
  (!process.env.BACKEND_SHARED_SECRET ||
    process.env.BACKEND_SHARED_SECRET.length < 32 ||
    process.env.TRUSTED_IP_HEADER !== "x-doctorfizz-proxy-ip")
) {
  console.error(
    "Split VPS mode requires a 32+ character bridge secret and TRUSTED_IP_HEADER=x-doctorfizz-proxy-ip.",
  );
  failed = true;
}

for (const name of required) {
  const value = process.env[name];
  if (
    !value ||
    (["IP_HASH_SALT", "BACKEND_SHARED_SECRET"].includes(name) &&
      value.length < 32)
  ) {
    console.error(name + ": missing or invalid");
    failed = true;
  }
}
for (const p of (bridge ? [] : providers()).filter(
  (p) => p.enabled && p.adapter === "api",
)) {
  const ready = !!(
    p.key &&
    p.modelId &&
    p.url &&
    p.costUsd > 0 &&
    Number.isFinite(p.costUsd)
  );
  console.log(
    p.id + ": " + (ready ? "configured" : "configuration incomplete"),
  );
  if (!ready) failed = true;
}
if (process.env.DEV_BYPASS_TURNSTILE === "true") {
  console.error("Disable DEV_BYPASS_TURNSTILE before launch.");
  failed = true;
}
process.exitCode = failed ? 1 : 0;
