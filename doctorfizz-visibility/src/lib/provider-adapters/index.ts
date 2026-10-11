import { adapter as openai } from "./openai";
import { adapter as anthropic } from "./anthropic";
import { adapter as gemini } from "./gemini";
import { adapter as perplexity } from "./perplexity";
import { adapter as xai } from "./xai";
import { adapter as deepseek } from "./deepseek";
import { adapter as mistral } from "./mistral";
import { adapter as llama } from "./llama";
import { adapter as qwen } from "./qwen";
import { adapter as cohere } from "./cohere";
import type { ProviderAdapter } from "./contract";
const registry: Record<string, ProviderAdapter> = {
  openai,
  anthropic,
  gemini,
  perplexity,
  xai,
  deepseek,
  mistral,
  llama,
  qwen,
  cohere,
};
export function getAdapter(id: string): ProviderAdapter {
  if (registry[id]) return registry[id];
  return {
    id,
    run: async (input) =>
      (await import("../../worker/browser-adapter")).runBrowser(id, input),
  };
}
