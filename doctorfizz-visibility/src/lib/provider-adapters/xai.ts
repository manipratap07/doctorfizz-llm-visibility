import { runProvider } from "../adapters";
import type { ProviderAdapter } from "./contract";
export const adapter: ProviderAdapter = {
  id: "xai",
  run: (input) => runProvider("xai", input),
};
