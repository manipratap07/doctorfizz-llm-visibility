import type { ProviderResult, Citation } from "./types";
import { providers } from "./providers.config";
type Json = Record<string, any>;
function citations(items: unknown[]): Citation[] {
  return [
    ...new Set(
      items
        .map((x) =>
          typeof x === "string" ? x : (x as Json)?.url || (x as Json)?.uri,
        )
        .filter(Boolean),
    ),
  ].flatMap((url) => {
    try {
      const u = new URL(String(url));
      return ["http:", "https:"].includes(u.protocol)
        ? [{ url: u.href, domain: u.hostname }]
        : [];
    } catch {
      return [];
    }
  });
}
export function parseResponse(
  id: string,
  j: Json,
): Omit<ProviderResult, "status" | "latencyMs"> {
  if (id === "mistral" && j.outputs) {
    const out = j.outputs || [];
    const msgs = out.filter((x: Json) => x.type === "message.output");
    const chunks = msgs.flatMap((x: Json) =>
      Array.isArray(x.content)
        ? x.content
        : [{ type: "text", text: x.content }],
    );
    return {
      answerText: chunks
        .filter((x: Json) => x.type === "text")
        .map((x: Json) => x.text)
        .join(""),
      citations: citations(
        chunks.filter((x: Json) => x.type === "tool_reference"),
      ),
      modelReported: msgs.find((x: Json) => x.model)?.model,
      webSearchUsed: out.some(
        (x: Json) => x.type === "tool.execution" && x.name === "web_search",
      ),
    };
  }
  if (id === "gemini") {
    const c = j.candidates?.[0];
    return {
      answerText: (c?.content?.parts || [])
        .filter((p: Json) => p.thought !== true)
        .map((p: Json) => p.text || "")
        .join(""),
      citations: citations(
        (c?.groundingMetadata?.groundingChunks || []).map((x: Json) => x.web),
      ),
      modelReported: j.modelVersion,
      webSearchUsed: !!c?.groundingMetadata?.webSearchQueries?.length,
    };
  }
  if (id === "anthropic") {
    const blocks = j.content || [];
    return {
      answerText: blocks
        .filter((x: Json) => x.type === "text")
        .map((x: Json) => x.text)
        .join("\n"),
      citations: citations(
        blocks.flatMap((x: Json) =>
          (x.citations || []).map((c: Json) => ({ url: c.url })),
        ),
      ),
      modelReported: j.model,
      webSearchUsed: blocks.some(
        (x: Json) =>
          x.type === "web_search_tool_result" && Array.isArray(x.content),
      ),
    };
  }
  if (id === "openai" || id === "xai") {
    const out = j.output || [];
    const text = out
      .flatMap((x: Json) => x.content || [])
      .filter((x: Json) => x.type === "output_text");
    return {
      answerText: j.output_text || text.map((x: Json) => x.text).join("\n"),
      citations: citations([
        ...text.flatMap((x: Json) =>
          (x.annotations || [])
            .filter((a: Json) => a.type === "url_citation")
            .map((a: Json) => a.url),
        ),
        ...(j.citations || []),
      ]),
      modelReported: j.model,
      webSearchUsed: out.some(
        (x: Json) =>
          x.type === "web_search_call" ||
          (x.type === "custom_tool_call" && /web_search/.test(x.name || "")),
      ),
    };
  }
  if (id === "cohere")
    return {
      answerText: (j.message?.content || [])
        .map((x: Json) => x.text || "")
        .join(""),
      citations: [],
      modelReported: j.model,
      webSearchUsed: false,
    };
  return {
    answerText: j.choices?.[0]?.message?.content || "",
    citations: citations([
      ...(j.citations || []),
      ...(id === "perplexity" ? j.search_results || [] : []),
    ]),
    modelReported: j.model,
    webSearchUsed:
      id === "perplexity" &&
      !!(j.citations?.length || j.search_results?.length),
  };
}
export async function runProvider(
  id: string,
  input: { prompt: string; locale?: string; signal: AbortSignal },
): Promise<ProviderResult> {
  const p = providers().find((p) => p.id === id);
  const started = Date.now();
  if (!p || !p.enabled || !p.key || !p.modelId || !p.url)
    return {
      status: "error",
      webSearchUsed: false,
      latencyMs: 0,
      errorReason:
        "Provider credentials, model or endpoint are not configured.",
    };
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + p.key,
  };
  let url = p.url;
  let body: Json = {
    model: p.modelId,
    messages: [{ role: "user", content: input.prompt }],
    max_tokens: 2500,
  };
  if (id === "openai" || id === "xai")
    body = {
      model: p.modelId,
      input: input.prompt,
      tools: [{ type: "web_search" }],
      max_output_tokens: 2500,
    };
  if (id === "anthropic") {
    delete headers.Authorization;
    headers["x-api-key"] = p.key;
    headers["anthropic-version"] = "2023-06-01";
    body = {
      ...body,
      tools: [
        {
          type:
            process.env.ANTHROPIC_SEARCH_TOOL_VERSION || "web_search_20250305",
          name: "web_search",
          max_uses: 3,
        },
      ],
    };
  }
  if (id === "gemini") {
    delete headers.Authorization;
    headers["x-goog-api-key"] = p.key;
    url = p.url + "/" + encodeURIComponent(p.modelId) + ":generateContent";
    body = {
      contents: [{ parts: [{ text: input.prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { maxOutputTokens: 2500 },
    };
  }
  if (id === "mistral")
    body = {
      model: p.modelId,
      inputs: input.prompt,
      tools: [{ type: "web_search" }],
      store: false,
      completion_args: { max_tokens: 2500 },
    };
  if (id === "cohere")
    body = {
      model: p.modelId,
      messages: [{ role: "user", content: input.prompt }],
      max_tokens: 2500,
    };
  try {
    const r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: input.signal,
    });
    if (!r.ok) {
      return {
        status:
          r.status === 429
            ? "rate_limited"
            : r.status === 401 || r.status === 403
              ? "blocked"
              : "error",
        webSearchUsed: false,
        latencyMs: Date.now() - started,
        errorReason: "Provider returned HTTP " + r.status,
      };
    }
    const parsed = parseResponse(id, await r.json());
    if (!parsed.answerText?.trim())
      return {
        status: "error",
        webSearchUsed: parsed.webSearchUsed,
        latencyMs: Date.now() - started,
        errorReason: "Provider returned no answer text.",
      };
    return { status: "ok", ...parsed, latencyMs: Date.now() - started };
  } catch (e) {
    return {
      status: input.signal.aborted ? "timeout" : "error",
      webSearchUsed: false,
      latencyMs: Date.now() - started,
      errorReason: input.signal.aborted
        ? "Provider exceeded the time limit."
        : "Provider connection failed.",
    };
  }
}
