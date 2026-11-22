import { db, must } from "./supabase";
import { HttpError, E } from "./http";
import type { Auth } from "./auth";
import { AI_LIMITS, RECIPE_COST } from "@/config/pricing";
import { spendCredit, refundCredit } from "./credits";
import { aiConfigured, AiNotConfigured } from "./ai/provider";
import { generateRecipe, AiRefused, RecipeSchema, type Recipe } from "./ai/recipe";
import { generateCard, CardSchema, isCoachKind, type Card, type CoachKind } from "./ai/coach";
import { enforceGenerationLimits, withDeadline } from "./ai/limits";
import { createHash } from "node:crypto";
import { cautionsFor, hasMedicalFlag, isRefusalRequest, DOCTOR_NOTE_AR, DOCTOR_NOTE_EN, REFUSAL_AR, REFUSAL_EN } from "./ai/safety";

export type CoachContent = {
  kind: CoachKind;
  recipe?: Recipe;
  card?: Card;
  cautions: { ar: string; en: string }[];
  doctor_note: { ar: string; en: string } | null;
};
export type RecipeContent = CoachContent;

const CACHE_DAYS = 30;
/** Same kind + request text + goal + declared conditions => same cached answer (saves provider cost). */
export function recipeCacheKey(text: string, goal: string | null, conditions: string[], kind: CoachKind = "recipe"): string {
  const norm = text.toLowerCase().replace(/[\p{P}\s]+/gu, " ").trim();
  return createHash("sha256").update(`${kind}|${norm}|${goal ?? ""}|${[...conditions].sort().join(",")}`).digest("hex");
}

async function cachedOutput(key: string, kind: CoachKind): Promise<Recipe | Card | null> {
  const row = must(await db().from("hl_ai_cache").select("recipe,hits,created_at").eq("key", key).maybeSingle()) as { recipe: unknown; hits: number; created_at: string } | null;
  if (!row || Date.now() - new Date(row.created_at).getTime() > CACHE_DAYS * 86400000) return null;
  const parsed = (kind === "recipe" ? RecipeSchema : CardSchema).safeParse(row.recipe);
  if (!parsed.success) return null;
  await db().from("hl_ai_cache").update({ hits: row.hits + 1 }).eq("key", key);
  return parsed.data;
}

export const refusal = (ar = REFUSAL_AR, en = REFUSAL_EN) => new HttpError(422, "refused", ar, en);

export function wrapContent(kind: CoachKind, out: Recipe | Card, conditions: string[]): CoachContent {
  return {
    kind,
    ...(kind === "recipe" ? { recipe: out as Recipe } : { card: out as Card }),
    cautions: cautionsFor(conditions),
    doctor_note: hasMedicalFlag(conditions) ? { ar: DOCTOR_NOTE_AR, en: DOCTOR_NOTE_EN } : null,
  };
}

/**
 * One new AI request (recipe, workout or challenge) = exactly 1 credit. Order of checks:
 *  limits (hour / day / one at a time / global) -> credit spent atomically -> model call under a hard
 *  deadline -> refund automatically on any failure, timeout, unusable output or refusal.
 */
export async function coachGenerate(a: Auth, prompt: string, kindIn: unknown = "recipe") {
  const kind: CoachKind = isCoachKind(kindIn) ? kindIn : "recipe";
  const text = prompt.trim();
  if (text.length < 3 || text.length > AI_LIMITS.maxPromptChars) throw E.bad(`اكتب طلبًا قصيرًا (٣ إلى ${AI_LIMITS.maxPromptChars} حرفًا).`, `Keep your request short (3 to ${AI_LIMITS.maxPromptChars} characters).`);
  if (isRefusalRequest(text)) throw refusal();
  if (!aiConfigured()) throw E.notConfigured("الكوتش");
  await enforceGenerationLimits(a.username);

  const req = must(
    await db().from("hl_ai_requests").insert({ username: a.username, type: "recipe", input_summary: `[${kind}] ${text}`.slice(0, 200), credit_cost: RECIPE_COST, status: "pending" }).select("id").single(),
  ) as { id: string };

  const spent = await spendCredit(a.username, req.id);
  if (!spent) {
    must(await db().from("hl_ai_requests").update({ status: "failed", credit_cost: 0, error: "no_credits" }).eq("id", req.id));
    throw E.noCredits();
  }

  try {
    const out = await withDeadline(
      (async () => {
        const key = recipeCacheKey(text, a.profile.goal, a.profile.conditions, kind);
        let o = await cachedOutput(key, kind);
        if (!o) {
          const ctx = { goal: a.profile.goal, conditions: a.profile.conditions };
          o = kind === "recipe" ? await generateRecipe(text, ctx) : await generateCard(kind, text, ctx);
          await db().from("hl_ai_cache").upsert({ key, recipe: o, hits: 0, created_at: new Date().toISOString() }, { onConflict: "key" });
        }
        return o;
      })(),
    );
    const content = wrapContent(kind, out, a.profile.conditions);
    const title = "name" in out ? out.name : "";
    const saved = must(
      await db().from("hl_recipes").insert({ username: a.username, title, content, source_request_id: req.id }).select("id,title,content,shared,like_count,save_count,created_at,username").single(),
    );
    must(await db().from("hl_ai_requests").update({ status: "completed", output: out }).eq("id", req.id));
    return saved;
  } catch (e) {
    await refundCredit(req.id);
    const reason = e instanceof AiRefused ? "refused" : e instanceof AiNotConfigured ? "not_configured" : e instanceof Error ? e.message.slice(0, 120) : "failed";
    must(await db().from("hl_ai_requests").update({ status: "refunded", error: reason }).eq("id", req.id));
    if (e instanceof AiRefused) throw refusal(e.message_ar, e.message_ar);
    if (e instanceof AiNotConfigured) throw E.notConfigured("الكوتش");
    if (e instanceof Error && e.message === "timeout") throw new HttpError(504, "ai_timeout", "الرد تأخّر أكثر من اللازم، فأعدنا لك الكريدت تلقائيًا. حاول مرة أخرى.", "The answer took too long, so your credit was refunded automatically. Please try again.");
    throw new HttpError(502, "ai_failed", "تعذّر توليد نتيجة صالحة هذه المرة. أعدنا لك الكريدت تلقائيًا، حاول مرة أخرى.", "We couldn't produce a valid result this time. Your credit was refunded automatically; please try again.");
  }
}
