import { runProvider } from "../adapters";
import type { ProviderAdapter } from "./contract";
export const adapter: ProviderAdapter = {
  id: "perplexity",
  run: (input) => runProvider("perplexity", input),
};
