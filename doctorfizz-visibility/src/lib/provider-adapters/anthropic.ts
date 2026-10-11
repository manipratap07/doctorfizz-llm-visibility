import { runProvider } from "../adapters";
import type { ProviderAdapter } from "./contract";
export const adapter: ProviderAdapter = {
  id: "anthropic",
  run: (input) => runProvider("anthropic", input),
};
