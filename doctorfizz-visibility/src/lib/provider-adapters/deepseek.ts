import { runProvider } from "../adapters";
import type { ProviderAdapter } from "./contract";
export const adapter: ProviderAdapter = {
  id: "deepseek",
  run: (input) => runProvider("deepseek", input),
};
