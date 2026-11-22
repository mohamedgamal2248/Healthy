import { db, must } from "./supabase";
import { HttpError, E } from "./http";
import type { Auth } from "./auth";
import { RECIPE_COST } from "@/config/pricing";
import { spendCredit, refundCredit } from "./credits";
import { aiConfigured, AiNotConfigured } from "./ai/provider";
import { generateRecipe, AiRefused, type Recipe } from "./ai/recipe";
import { cautionsFor, hasMedicalFlag, isRefusalRequest, DOCTOR_NOTE_AR, DOCTOR_NOTE_EN, REFUSAL_AR, REFUSAL_EN } from "./ai/safety";

export type RecipeContent = {
  recipe: Recipe;
  cautions: { ar: string; en: string }[];
  doctor_note: { ar: string; en: string } | null;
};

export const refusal = () => new HttpError(422, "refused", REFUSAL_AR, REFUSAL_EN);

export function wrapRecipe(recipe: Recipe, conditions: string[]): RecipeContent {
  return {
    recipe,
    cautions: cautionsFor(conditions),
    doctor_note: hasMedicalFlag(conditions) ? { ar: DOCTOR_NOTE_AR, en: DOCTOR_NOTE_EN } : null,
  };
}

/**
 * One new recipe = exactly 1 credit. Credit is spent atomically (per-user lock) BEFORE the model runs and
 * refunded automatically if generation fails or the output is unusable. Refusals never cost a credit.
 */
export async function chefGenerate(a: Auth, prompt: string) {
  const text = prompt.trim();
  if (text.length < 3 || text.length > 600) throw E.bad("اكتب وصفًا قصيرًا لما تريده (٣ إلى ٦٠٠ حرف).", "Describe what you want (3 to 600 characters).");
  if (isRefusalRequest(text)) throw refusal();
  if (!aiConfigured()) throw E.notConfigured("الشيف AI");

  const req = must(
    await db().from("ai_requests").insert({ username: a.username, type: "recipe", input_summary: text.slice(0, 200), credit_cost: RECIPE_COST, status: "pending" }).select("id").single(),
  ) as { id: string };

  const kind = await spendCredit(a.username, req.id);
  if (!kind) {
    must(await db().from("ai_requests").update({ status: "failed", credit_cost: 0, error: "no_credits" }).eq("id", req.id));
    throw E.noCredits();
  }

  try {
    const recipe = await generateRecipe(text, { goal: a.profile.goal, conditions: a.profile.conditions });
    const content = wrapRecipe(recipe, a.profile.conditions);
    const saved = must(
      await db().from("recipes").insert({ username: a.username, title: recipe.name, content, source_request_id: req.id }).select("id,title,content,shared,like_count,save_count,created_at,username").single(),
    );
    must(await db().from("ai_requests").update({ status: "completed", output: recipe }).eq("id", req.id));
    return saved;
  } catch (e) {
    await refundCredit(req.id);
    const reason = e instanceof AiRefused ? "refused" : e instanceof AiNotConfigured ? "not_configured" : e instanceof Error ? e.message.slice(0, 120) : "failed";
    must(await db().from("ai_requests").update({ status: "refunded", error: reason }).eq("id", req.id));
    if (e instanceof AiRefused) throw refusal();
    if (e instanceof AiNotConfigured) throw E.notConfigured("الشيف AI");
    throw new HttpError(502, "ai_failed", "تعذّر توليد وصفة صالحة هذه المرة. أعدنا لك الكريدت تلقائيًا، حاول مرة أخرى.", "We couldn't produce a valid recipe this time. Your credit was refunded automatically; please try again.");
  }
}
