import { runProvider } from "../adapters";
import type { ProviderAdapter } from "./contract";
export const adapter: ProviderAdapter = {
  id: "mistral",
  run: (input) => runProvider("mistral", input),
};
