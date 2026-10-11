import { runProvider } from "../adapters";
import type { ProviderAdapter } from "./contract";
export const adapter: ProviderAdapter = {
  id: "gemini",
  run: (input) => runProvider("gemini", input),
};
