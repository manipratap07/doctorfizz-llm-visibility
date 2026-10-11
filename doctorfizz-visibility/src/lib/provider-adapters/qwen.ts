import { runProvider } from "../adapters";
import type { ProviderAdapter } from "./contract";
export const adapter: ProviderAdapter = {
  id: "qwen",
  run: (input) => runProvider("qwen", input),
};
