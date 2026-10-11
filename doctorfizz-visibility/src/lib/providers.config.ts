export const definitions = [
  [
    "openai",
    "ChatGPT · OpenAI",
    "A",
    "OPENAI",
    true,
    "https://api.openai.com/v1/responses",
  ],
  [
    "anthropic",
    "Claude",
    "A",
    "ANTHROPIC",
    true,
    "https://api.anthropic.com/v1/messages",
  ],
  [
    "gemini",
    "Gemini",
    "A",
    "GEMINI",
    true,
    "https://generativelanguage.googleapis.com/v1beta/models",
  ],
  [
    "perplexity",
    "Perplexity",
    "A",
    "PERPLEXITY",
    true,
    "https://api.perplexity.ai/chat/completions",
  ],
  ["xai", "Grok", "A", "XAI", true, "https://api.x.ai/v1/responses"],
  [
    "deepseek",
    "DeepSeek",
    "B",
    "DEEPSEEK",
    false,
    "https://api.deepseek.com/chat/completions",
  ],
  [
    "mistral",
    "Mistral",
    "B",
    "MISTRAL",
    true,
    "https://api.mistral.ai/v1/conversations",
  ],
  [
    "llama",
    "Llama · via Groq",
    "B",
    "GROQ",
    false,
    "https://api.groq.com/openai/v1/chat/completions",
  ],
  ["qwen", "Qwen", "B", "QWEN", false, ""],
  [
    "cohere",
    "Cohere Command",
    "B",
    "COHERE",
    false,
    "https://api.cohere.com/v2/chat",
  ],
] as const;
export function providers() {
  const api = definitions.map(
    ([id, displayName, tier, prefix, webSearch, url]) => ({
      id,
      displayName,
      tier,
      logo: displayName[0],
      adapter: "api" as const,
      modelId: process.env[`${prefix}_MODEL_ID`] || "",
      key: process.env[`${prefix}_API_KEY`] || "",
      url: process.env[`${prefix}_API_URL`] || url,
      webSearch,
      timeoutMs: 45000,
      maxConcurrency: Number(process.env[`${prefix}_CONCURRENCY`] || 2),
      enabled: process.env[`${prefix}_ENABLED`] !== "false",
      costUsd: Number(process.env[`${prefix}_COST_CEILING_USD`] || 0),
    }),
  );
  return [...api, ...browserProviders()];
}
export const publicProviders = definitions.map(
  ([id, displayName, tier, , webSearch]) => ({
    id,
    displayName,
    tier,
    webSearch,
  }),
);

function browserProviders() {
  return [
    {
      id: "copilot",
      displayName: "Microsoft Copilot",
      url: "https://copilot.microsoft.com/",
    },
    {
      id: "google-ai",
      displayName: "Google AI Mode",
      url: "https://www.google.com/",
    },
  ].map((p) => ({
    ...p,
    tier: "C",
    logo: p.displayName[0],
    adapter: "playwright",
    modelId:
      process.env[
        p.id === "copilot" ? "COPILOT_MODEL_ID" : "GOOGLE_AI_MODEL_ID"
      ] || "",
    key: "",
    webSearch: true,
    timeoutMs: 90000,
    maxConcurrency: 1,
    costUsd: 0,
    enabled:
      process.env.TIER_C_ENABLED === "true" &&
      process.env.TIER_C_TERMS_REVIEWED === "true",
  }));
}
export function getPublicProviders() {
  return providers()
    .filter((p) => p.adapter === "api" || p.enabled)
    .map((p) => ({
      id: p.id,
      displayName: p.displayName,
      tier: p.tier,
      enabled: p.enabled,
      webSearch: p.webSearch,
      configured:
        p.adapter === "playwright" ||
        !!(
          p.key &&
          p.modelId &&
          p.url &&
          Number.isFinite(p.costUsd) &&
          p.costUsd > 0
        ),
    }));
}
