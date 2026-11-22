// The only module that talks to a model provider. Provider, model and key come from env and never
// reach the client. If nothing is configured we throw AiNotConfigured -- we never fabricate AI output.
import { AsyncLocalStorage } from "node:async_hooks";
import { AI_LIMITS, AI_PRICES } from "@/config/pricing";

export type Usage = { tokensIn: number; tokensOut: number; searches: number };
const usageStore = new AsyncLocalStorage<Usage>();
const addUsage = (u: Partial<Usage>) => {
  const s = usageStore.getStore();
  if (!s) return;
  s.tokensIn += u.tokensIn ?? 0; s.tokensOut += u.tokensOut ?? 0; s.searches += u.searches ?? 0;
};
/** Run `fn` and collect the real token / search usage of every provider call it makes. */
export async function trackUsage<T>(fn: () => Promise<T>): Promise<{ result: T; usage: Usage }> {
  const usage: Usage = { tokensIn: 0, tokensOut: 0, searches: 0 };
  try {
    const result = await usageStore.run(usage, fn);
    return { result, usage };
  } catch (e) {
    (e as { usage?: Usage }).usage = usage;
    throw e;
  }
}
export const estimateCostUsd = (u: Usage) => (u.tokensIn * AI_PRICES.inputPerM + u.tokensOut * AI_PRICES.outputPerM) / 1e6 + u.searches * AI_PRICES.searchEach;

export class AiNotConfigured extends Error {
  constructor() {
    super("AI provider not configured");
  }
}
export class AiProviderError extends Error {}

export type AiMessage = { role: "user" | "assistant"; content: string; /** data: URLs (jpeg/png/webp); sent as image parts to the model */ images?: string[] };

const IMAGE_TOKENS_ESTIMATE = 2500; // generous estimate per image for the input-size guard
type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
/** OpenAI-compatible message (Meta Chat Completions accepts the same image_url parts). */
const toChatMessage = (m: AiMessage) => (m.images?.length ? { role: m.role, content: [{ type: "text", text: m.content } as Part, ...m.images.map((url) => ({ type: "image_url", image_url: { url } }) as Part)] } : { role: m.role, content: m.content });
function toAnthropicMessage(m: AiMessage) {
  if (!m.images?.length) return { role: m.role, content: m.content };
  const parts = m.images.map((url) => {
    const mm = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(url);
    return { type: "image", source: { type: "base64", media_type: mm?.[1] ?? "image/jpeg", data: mm?.[2] ?? "" } };
  });
  return { role: m.role, content: [...parts, { type: "text", text: m.content }] };
}

const provider = () => (process.env.AI_PROVIDER ?? "meta").toLowerCase();
/** Meta Model API defaults to Muse Ember; other providers need AI_MODEL set explicitly. */
const modelName = () => process.env.AI_MODEL || (provider() === "meta" ? "muse-ember-1.0" : "");

export function aiConfigured(): boolean {
  return !!(process.env.AI_API_KEY && modelName());
}

/** Hard guards so one request can never reach the provider's higher-priced tier (above 200K input tokens). */
export const MAX_INPUT_TOKENS_ESTIMATE = 60_000; // our prompts are a few thousand tokens; refuse anything near the 200K tier
export const MAX_OUTPUT_TOKENS = 12_000;
const estimateTokens = (s: string) => Math.ceil(s.length / 2); // conservative for Arabic

export async function callModel(opts: { system: string; messages: AiMessage[]; maxTokens?: number; temperature?: number; webSearch?: boolean }): Promise<string> {
  const approx = estimateTokens(opts.system) + opts.messages.reduce((n, m) => n + estimateTokens(m.content) + (m.images?.length ?? 0) * IMAGE_TOKENS_ESTIMATE, 0);
  if (approx > MAX_INPUT_TOKENS_ESTIMATE) throw new AiProviderError("input too large");
  const key = process.env.AI_API_KEY;
  const model = modelName();
  if (!key || !model) throw new AiNotConfigured();
  const prov = provider();
  const maxTokens = Math.min(opts.maxTokens ?? 1800, MAX_OUTPUT_TOKENS - 4000);
  const temperature = opts.temperature ?? 0.4;

  try {
    if (prov === "meta") {
      const base = (process.env.AI_BASE_URL || "https://api.meta.ai/v1").replace(/\/$/, "");
      const effort = process.env.AI_REASONING_EFFORT || "low";
      const headers = { "content-type": "application/json", authorization: `Bearer ${key}` };
      // Prompt caching is automatic on stable prefixes; the key routes our identical system prompts together.
      const cache = { prompt_cache_key: "healthy-chef", prompt_cache_retention: "24h" };
      if (opts.webSearch) {
        // Responses API with the built-in web search tool (the model decides whether to search; billed per query).
        try {
          const res = await fetch(`${base}/responses`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model,
              instructions: opts.system,
              input: opts.messages.map((m) => ({ role: m.role, content: [{ type: m.role === "user" ? "input_text" : "output_text", text: m.content }] })),
              reasoning: { effort },
              max_output_tokens: maxTokens + 4000,
              store: false,
              tools: [{ type: "web_search", search_context_size: "low" }],
              ...cache,
            }),
            signal: AbortSignal.timeout(AI_LIMITS.timeoutMs - 10_000),
          });
          if (res.ok) {
            const data = (await res.json()) as { output?: { type: string; content?: { type: string; text?: string }[] }[]; usage?: { input_tokens?: number; output_tokens?: number } };
            addUsage({ tokensIn: data.usage?.input_tokens, tokensOut: data.usage?.output_tokens, searches: (data.output ?? []).filter((o) => o.type === "web_search_call").length });
            const text = (data.output ?? []).filter((o) => o.type === "message").flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? "").join("");
            if (text.trim()) return text;
          } else console.error("[ai] responses+web_search failed", res.status);
        } catch (e) {
          console.error("[ai] responses+web_search error", e instanceof Error ? e.message : e);
        }
        // fall through: plain Chat Completions without search
      }
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          reasoning_effort: effort,
          max_completion_tokens: maxTokens + 4000,
          messages: [{ role: "system", content: opts.system }, ...opts.messages.map(toChatMessage)],
          ...cache,
        }),
        signal: AbortSignal.timeout(AI_LIMITS.timeoutMs - 10_000),
      });
      if (!res.ok) throw new AiProviderError(`meta ${res.status}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      addUsage({ tokensIn: data.usage?.prompt_tokens, tokensOut: data.usage?.completion_tokens });
      return data.choices?.[0]?.message?.content ?? "";
    }
    if (prov === "anthropic") {
      const base = (process.env.AI_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
      const res = await fetch(`${base}/v1/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature, system: opts.system, messages: opts.messages.map(toAnthropicMessage) }),
        signal: AbortSignal.timeout(AI_LIMITS.timeoutMs - 10_000),
      });
      if (!res.ok) throw new AiProviderError(`anthropic ${res.status}`);
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      return (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
    }
    // OpenAI-compatible chat completions
    const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, temperature, max_tokens: maxTokens, messages: [{ role: "system", content: opts.system }, ...opts.messages.map(toChatMessage)] }),
      signal: AbortSignal.timeout(AI_LIMITS.timeoutMs - 10_000),
    });
    if (!res.ok) throw new AiProviderError(`openai ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    if (e instanceof AiProviderError) throw e;
    throw new AiProviderError(e instanceof Error ? e.message : "ai request failed");
  }
}

/** Pull the first JSON object out of a model reply (tolerates code fences / prose). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced ? fenced[1] : text;
  const start = src.indexOf("{");
  const end = src.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json");
  return JSON.parse(src.slice(start, end + 1));
}
