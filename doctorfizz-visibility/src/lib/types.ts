export type SiteProfile = {
  category: string;
  subCategory: string;
  primaryOffering: string;
  targetAudience: string;
  isLocalBusiness: boolean;
  location: string;
  language: string;
  confidence: number;
};
export type Prompt = { id: string; type: string; text: string };
export type Brand = { name: string; aliases: string[]; domain: string };
export type Citation = { url: string; title?: string; domain: string };
export type ProviderResult = {
  status: "ok" | "timeout" | "blocked" | "rate_limited" | "error";
  answerText?: string;
  citations?: Citation[];
  modelReported?: string;
  webSearchUsed: boolean;
  latencyMs: number;
  errorReason?: string;
};
export type Entity = {
  name: string;
  position: number | null;
  snippet: string;
  sentiment: "positive" | "neutral" | "negative";
};
export type Analysis = {
  mentioned: boolean;
  ambiguous: boolean;
  position: number | null;
  totalEntities: number;
  cited: boolean;
  citationUrls: string[];
  sentiment: Entity["sentiment"];
  snippet: string;
  competitors: Entity[];
  score: number;
};
export type Run = {
  id: string;
  provider_id: string;
  status: string;
  reason?: string;
  answer_text?: string;
  citations: Citation[];
  model_reported?: string;
  web_search_used: boolean;
  latency_ms?: number;
  from_cache: boolean;
  cache_created_at?: string;
  created_at: string;
  completed_at?: string;
  analysis?: Analysis;
  repeat_index: number;
};
export type Check = {
  id: string;
  brand: Brand;
  prompt_text: string;
  status: string;
  created_at: string;
  runs: Run[];
  refunded: boolean;
};
