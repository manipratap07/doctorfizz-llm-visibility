import { runProvider } from "../adapters";
import type { ProviderAdapter } from "./contract";
export const adapter: ProviderAdapter = {
  id: "openai",
  run: (input) => runProvider("openai", input),
};
