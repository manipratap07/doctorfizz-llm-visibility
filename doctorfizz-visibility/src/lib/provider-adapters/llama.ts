import { runProvider } from "../adapters";
import type { ProviderAdapter } from "./contract";
export const adapter: ProviderAdapter = {
  id: "llama",
  run: (input) => runProvider("llama", input),
};
