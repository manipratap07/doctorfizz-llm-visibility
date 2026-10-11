import type { ProviderResult } from "../types";
export interface ProviderAdapter {
  id: string;
  run(input: {
    prompt: string;
    locale?: string;
    signal: AbortSignal;
  }): Promise<ProviderResult>;
}
