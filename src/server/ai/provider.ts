// The only module that talks to a model provider. Provider, model and key come from env and never
// reach the client. If nothing is configured we throw AiNotConfigured -- we never fabricate AI output.
export class AiNotConfigured extends Error {
  constructor() {
    super("AI provider not configured");
  }
}
export class AiProviderError extends Error {}

export type AiMessage = { role: "user" | "assistant"; content: string };

const provider = () => (process.env.AI_PROVIDER ?? "meta").toLowerCase();
/** Meta Model API defaults to Muse Ember; other providers need AI_MODEL set explicitly. */
const modelName = () => process.env.AI_MODEL || (provider() === "meta" ? "muse-ember-1.0" : "");

export function aiConfigured(): boolean {
  return !!(process.env.AI_API_KEY && modelName());
}

export async function callModel(opts: { system: string; messages: AiMessage[]; maxTokens?: number; temperature?: number }): Promise<string> {
  const key = process.env.AI_API_KEY;
  const model = modelName();
  if (!key || !model) throw new AiNotConfigured();
  const prov = provider();
  const maxTokens = opts.maxTokens ?? 1800;
  const temperature = opts.temperature ?? 0.4;

  try {
    if (prov === "meta") {
      // Meta Model API: OpenAI-compatible Chat Completions. Muse Ember always reasons, so keep the effort
      // low (default is "max": slow and costly) and leave headroom in max_completion_tokens for reasoning.
      const base = (process.env.AI_BASE_URL || "https://api.meta.ai/v1").replace(/\/$/, "");
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          reasoning_effort: process.env.AI_REASONING_EFFORT || "low",
          max_completion_tokens: maxTokens + 4000,
          messages: [{ role: "system", content: opts.system }, ...opts.messages],
        }),
        signal: AbortSignal.timeout(100000),
      });
      if (!res.ok) throw new AiProviderError(`meta ${res.status}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return data.choices?.[0]?.message?.content ?? "";
    }
    if (prov === "anthropic") {
      const base = (process.env.AI_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
      const res = await fetch(`${base}/v1/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature, system: opts.system, messages: opts.messages }),
        signal: AbortSignal.timeout(55000),
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
      body: JSON.stringify({ model, temperature, max_tokens: maxTokens, messages: [{ role: "system", content: opts.system }, ...opts.messages] }),
      signal: AbortSignal.timeout(55000),
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
