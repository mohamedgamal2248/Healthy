import { db, must } from "./supabase";
import { HttpError, E } from "./http";
import type { Auth } from "./auth";
import { AI_LIMITS, RECIPE_COST } from "@/config/pricing";
import { spendCredit, refundCredit } from "./credits";
import { aiConfigured, AiNotConfigured, trackUsage, estimateCostUsd, type Usage } from "./ai/provider";
import { generateRecipe, AiRefused, RecipeSchema, type Recipe } from "./ai/recipe";
import { generateCard, CardSchema, isCoachKind, type Card, type CoachKind } from "./ai/coach";
import { enforceGenerationLimits, withDeadline } from "./ai/limits";
import { analyzeMealPhoto, validImage, type Scan } from "./ai/scan";
import { generateFridge, refineRecipe, refineWorkout, isRecipeRefine, isWorkoutRefine, cleanNote, type Fridge } from "./ai/extra";
import { ctxKey, dayCtxFrom, prefsFromProfile, type DayCtx } from "./ai/context";
import { foodDay } from "./food";
import { addDays } from "@/lib/dates";
import { createHash } from "node:crypto";
import { detectLang, asLang } from "./ai/lang";
import { cautionsFor, hasMedicalFlag, isRefusalRequest, DOCTOR_NOTE_AR, DOCTOR_NOTE_EN, REFUSAL_AR, REFUSAL_EN } from "./ai/safety";

export type CoachContent = {
  kind: CoachKind | "scan" | "fridge";
  scan?: Scan;
  fridge?: Fridge;
  recipe?: Recipe;
  card?: Card;
  cautions: { ar: string; en: string }[];
  doctor_note: { ar: string; en: string } | null;
};
export type RecipeContent = CoachContent;

const CACHE_DAYS = 30;
/** Same kind + request text + goal + declared conditions => same cached answer (saves provider cost). */
export function recipeCacheKey(text: string, goal: string | null, conditions: string[], kind: CoachKind = "recipe", lang: "ar" | "en" = "ar", extra = ""): string {
  const norm = text.toLowerCase().replace(/[\p{P}\s]+/gu, " ").trim();
  return createHash("sha256").update(`${kind}|${lang}|${norm}|${goal ?? ""}|${[...conditions].sort().join(",")}${extra ? `|${extra}` : ""}`).digest("hex");
}

async function cachedOutput(key: string, kind: CoachKind): Promise<Recipe | Card | null> {
  const row = must(await db().from("hl_ai_cache").select("recipe,hits,created_at").eq("key", key).maybeSingle()) as { recipe: unknown; hits: number; created_at: string } | null;
  if (!row || Date.now() - new Date(row.created_at).getTime() > CACHE_DAYS * 86400000) return null;
  const parsed = (kind === "recipe" ? RecipeSchema : CardSchema).safeParse(row.recipe);
  if (!parsed.success) return null;
  await db().from("hl_ai_cache").update({ hits: row.hits + 1 }).eq("key", key);
  return parsed.data;
}


/** Closes the check-then-insert race: if more than one of this user's requests is pending, this one backs off before spending a credit. */
async function assertSoleInFlight(username: string, requestId: string) {
  const r = await db().from("hl_ai_requests").select("id", { count: "exact", head: true }).eq("username", username).eq("status", "pending").gte("created_at", new Date(Date.now() - AI_LIMITS.inFlightWindowMs).toISOString());
  if ((r.count ?? 0) > 1) {
    await db().from("hl_ai_requests").update({ status: "failed", credit_cost: 0, error: "concurrent" }).eq("id", requestId);
    throw new HttpError(429, "in_flight", "عندك طلب قيد التنفيذ بالفعل. انتظر حتى ينتهي.", "You already have a request running. Please wait for it to finish.");
  }
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

/** Today's eating so far + local time, so a meal request fits what is left. Never blocks the request if it fails. */
async function dayContext(a: Auth): Promise<DayCtx | null> {
  try {
    const d = await foodDay(a);
    const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: a.tz }).format(new Date()));
    return dayCtxFrom(d.totals, d.target, d.entries.length, Number.isFinite(hour) ? hour : 12);
  } catch { return null; }
}

/**
 * One new AI request (recipe, workout or challenge) = exactly 1 credit. Order of checks:
 *  limits (hour / day / one at a time / global) -> credit spent atomically -> model call under a hard
 *  deadline -> refund automatically on any failure, timeout, unusable output or refusal.
 */
export async function coachGenerate(a: Auth, prompt: string, kindIn: unknown = "recipe", uiLang?: unknown) {
  const kind: CoachKind = isCoachKind(kindIn) ? kindIn : "recipe";
  const text = prompt.trim();
  // Answer in the language the user wrote in (falls back to the app language).
  const lang = detectLang(text, asLang(uiLang, a.profile.language === "en" ? "en" : "ar"));
  if (text.length < 3 || text.length > AI_LIMITS.maxPromptChars) throw E.bad(`اكتب طلبًا قصيرًا (٣ إلى ${AI_LIMITS.maxPromptChars} حرفًا).`, `Keep your request short (3 to ${AI_LIMITS.maxPromptChars} characters).`);
  if (isRefusalRequest(text)) throw refusal();
  if (!aiConfigured()) throw E.notConfigured("Healthy AI");
  await enforceGenerationLimits(a.username);

  const req = must(
    await db().from("hl_ai_requests").insert({ username: a.username, type: "recipe", input_summary: `[${kind}] ${text}`.slice(0, 200), credit_cost: RECIPE_COST, status: "pending" }).select("id").single(),
  ) as { id: string };

  await assertSoleInFlight(a.username, req.id);
  const spent = await spendCredit(a.username, req.id);
  if (!spent) {
    must(await db().from("hl_ai_requests").update({ status: "failed", credit_cost: 0, error: "no_credits" }).eq("id", req.id));
    throw E.noCredits();
  }

  let usage: Usage = { tokensIn: 0, tokensOut: 0, searches: 0 };
  try {
    const tracked = await trackUsage(() => withDeadline(
      (async () => {
        const prefs = prefsFromProfile(a.profile);
        const day = kind === "recipe" ? await dayContext(a) : null;
        const key = recipeCacheKey(text, a.profile.goal, a.profile.conditions, kind, lang, ctxKey(prefs, day));
        let o = await cachedOutput(key, kind);
        if (!o) {
          const ctx = { goal: a.profile.goal, conditions: a.profile.conditions, lang, prefs, day };
          o = kind === "recipe" ? await generateRecipe(text, ctx) : await generateCard(kind, text, ctx);
          await db().from("hl_ai_cache").upsert({ key, recipe: o, hits: 0, created_at: new Date().toISOString() }, { onConflict: "key" });
        }
        return o;
      })(),
    ));
    const out = tracked.result;
    usage = tracked.usage;
    const content = wrapContent(kind, out, a.profile.conditions);
    const title = "name" in out ? out.name : "";
    const saved = must(
      await db().from("hl_recipes").insert({ username: a.username, title, content, source_request_id: req.id }).select("id,title,content,shared,like_count,save_count,created_at,username").single(),
    );
    must(await db().from("hl_ai_requests").update({ status: "completed", output: out, tokens_in: usage.tokensIn, tokens_out: usage.tokensOut, searches: usage.searches, est_cost_usd: estimateCostUsd(usage) }).eq("id", req.id));
    return saved;
  } catch (e) {
    await refundCredit(req.id);
    const failUsage = (e as { usage?: Usage }).usage ?? usage;
    const reason = e instanceof AiRefused ? "refused" : e instanceof AiNotConfigured ? "not_configured" : e instanceof Error ? e.message.slice(0, 120) : "failed";
    must(await db().from("hl_ai_requests").update({ status: "refunded", error: reason, tokens_in: failUsage.tokensIn, tokens_out: failUsage.tokensOut, searches: failUsage.searches, est_cost_usd: estimateCostUsd(failUsage) }).eq("id", req.id));
    if (e instanceof AiRefused) throw refusal(e.message_ar, e.message_ar);
    if (e instanceof AiNotConfigured) throw E.notConfigured("Healthy AI");
    if (e instanceof Error && e.message === "timeout") throw new HttpError(504, "ai_timeout", "الرد تأخّر أكثر من اللازم، فأعدنا لك الكريدت تلقائيًا. حاول مرة أخرى.", "The answer took too long, so your credit was refunded automatically. Please try again.");
    throw new HttpError(502, "ai_failed", "تعذّر توليد نتيجة صالحة هذه المرة. أعدنا لك الكريدت تلقائيًا، حاول مرة أخرى.", "We couldn't produce a valid result this time. Your credit was refunded automatically; please try again.");
  }
}

/**
 * Meal-photo analysis. Same guarantees as every AI request: limits first, exactly 1 credit spent atomically,
 * hard deadline, automatic refund on failure / unusable output / "no food in the photo".
 * The photo itself is never stored: only the structured result is saved to the user's library.
 */
export async function scanMeal(a: Auth, image: unknown, note: unknown, uiLang?: unknown) {
  if (!validImage(image)) throw E.bad("الصورة غير صالحة أو كبيرة جدًا. التقط صورة أخرى (JPEG أو PNG أو WebP).", "The photo is invalid or too large. Take another one (JPEG, PNG or WebP).");
  const text = typeof note === "string" ? note.trim().slice(0, 200) : "";
  if (text && isRefusalRequest(text)) throw refusal();
  if (!aiConfigured()) throw E.notConfigured("Healthy AI");
  const lang = detectLang(text, asLang(uiLang, a.profile.language === "en" ? "en" : "ar"));
  await enforceGenerationLimits(a.username);

  const req = must(
    await db().from("hl_ai_requests").insert({ username: a.username, type: "recipe", input_summary: `[scan] ${text}`.slice(0, 200), credit_cost: RECIPE_COST, status: "pending" }).select("id").single(),
  ) as { id: string };
  await assertSoleInFlight(a.username, req.id);
  const spent = await spendCredit(a.username, req.id);
  if (!spent) {
    must(await db().from("hl_ai_requests").update({ status: "failed", credit_cost: 0, error: "no_credits" }).eq("id", req.id));
    throw E.noCredits();
  }
  let usage: Usage = { tokensIn: 0, tokensOut: 0, searches: 0 };
  try {
    const tracked = await trackUsage(() => withDeadline(analyzeMealPhoto(image, text, { goal: a.profile.goal, conditions: a.profile.conditions, allergies: prefsFromProfile(a.profile).allergies }, lang)));
    usage = tracked.usage;
    const scan = tracked.result;
    const content: CoachContent = { kind: "scan", scan, cautions: cautionsFor(a.profile.conditions), doctor_note: hasMedicalFlag(a.profile.conditions) ? { ar: DOCTOR_NOTE_AR, en: DOCTOR_NOTE_EN } : null };
    const saved = must(
      await db().from("hl_recipes").insert({ username: a.username, title: scan.dish_name, content, source_request_id: req.id }).select("id,title,content,shared,like_count,save_count,created_at,username").single(),
    );
    must(await db().from("hl_ai_requests").update({ status: "completed", output: { dish: scan.dish_name, kcal: scan.totals.calories.mid }, tokens_in: usage.tokensIn, tokens_out: usage.tokensOut, est_cost_usd: estimateCostUsd(usage) }).eq("id", req.id));
    return saved;
  } catch (e) {
    await refundCredit(req.id);
    const failUsage = (e as { usage?: Usage }).usage ?? usage;
    const reason = e instanceof AiRefused ? "no_food" : e instanceof Error ? e.message.slice(0, 120) : "failed";
    must(await db().from("hl_ai_requests").update({ status: "refunded", error: reason, tokens_in: failUsage.tokensIn, tokens_out: failUsage.tokensOut, est_cost_usd: estimateCostUsd(failUsage) }).eq("id", req.id));
    if (e instanceof AiRefused) throw refusal(e.message_ar, e.message_ar);
    if (e instanceof AiNotConfigured) throw E.notConfigured("Healthy AI");
    if (e instanceof Error && e.message === "timeout") throw new HttpError(504, "ai_timeout", "التحليل تأخّر أكثر من اللازم، فأعدنا لك الكريدت تلقائيًا. حاول مرة أخرى.", "The analysis took too long, so your credit was refunded automatically. Please try again.");
    throw new HttpError(502, "ai_failed", "تعذّر تحليل الصورة بدقة كافية. أعدنا لك الكريدت تلقائيًا. جرّب صورة أوضح من فوق وبإضاءة أفضل.", "We couldn't analyse the photo reliably. Your credit was refunded automatically. Try a clearer top-down photo in better light.");
  }
}

/**
 * "What's in my fridge": a photo and/or a list of ingredients -> 3 meal ideas that fit the user's preferences and what is left
 * of today's calories. Same guarantees as every paid request: limits first, exactly 1 credit spent atomically, hard deadline,
 * automatic refund on any failure / refusal / answer that ignores an allergy.
 */
export async function fridgeMeals(a: Auth, imageIn: unknown, textIn: unknown, uiLang?: unknown) {
  const text = typeof textIn === "string" ? textIn.trim().slice(0, 300) : "";
  const image = imageIn == null || imageIn === "" ? null : imageIn;
  if (image !== null && !validImage(image)) throw E.bad("الصورة غير صالحة أو كبيرة جدًا. التقط صورة أخرى (JPEG أو PNG أو WebP).", "The photo is invalid or too large. Take another one (JPEG, PNG or WebP).");
  if (!image && text.length < 3) throw E.bad("صوّر ما عندك أو اكتب المكونات.", "Take a photo of what you have, or list the ingredients.");
  if (text && isRefusalRequest(text)) throw refusal();
  if (!aiConfigured()) throw E.notConfigured("Healthy AI");
  const lang = detectLang(text, asLang(uiLang, a.profile.language === "en" ? "en" : "ar"));
  await enforceGenerationLimits(a.username);

  const req = must(
    await db().from("hl_ai_requests").insert({ username: a.username, type: "recipe", input_summary: `[fridge${image ? "+photo" : ""}] ${text}`.slice(0, 200), credit_cost: RECIPE_COST, status: "pending" }).select("id").single(),
  ) as { id: string };
  await assertSoleInFlight(a.username, req.id);
  const spent = await spendCredit(a.username, req.id);
  if (!spent) {
    must(await db().from("hl_ai_requests").update({ status: "failed", credit_cost: 0, error: "no_credits" }).eq("id", req.id));
    throw E.noCredits();
  }
  let usage: Usage = { tokensIn: 0, tokensOut: 0, searches: 0 };
  try {
    const tracked = await trackUsage(() => withDeadline((async () => {
      const day = await dayContext(a);
      return generateFridge(text, image as string | null, { goal: a.profile.goal, conditions: a.profile.conditions, lang, prefs: prefsFromProfile(a.profile), day });
    })()));
    usage = tracked.usage;
    const fridge = tracked.result;
    const content: CoachContent = { kind: "fridge", fridge, cautions: cautionsFor(a.profile.conditions), doctor_note: hasMedicalFlag(a.profile.conditions) ? { ar: DOCTOR_NOTE_AR, en: DOCTOR_NOTE_EN } : null };
    const title = (lang === "en" ? "From my fridge: " : "من اللي عندي: ") + fridge.seen.slice(0, 3).join(lang === "en" ? ", " : "، ");
    const saved = must(
      await db().from("hl_recipes").insert({ username: a.username, title: title.slice(0, 120), content, source_request_id: req.id }).select("id,title,content,shared,like_count,save_count,created_at,username").single(),
    );
    must(await db().from("hl_ai_requests").update({ status: "completed", output: { ideas: fridge.ideas.map((i) => i.name) }, tokens_in: usage.tokensIn, tokens_out: usage.tokensOut, est_cost_usd: estimateCostUsd(usage) }).eq("id", req.id));
    return saved;
  } catch (e) {
    await refundCredit(req.id);
    const failUsage = (e as { usage?: Usage }).usage ?? usage;
    const reason = e instanceof AiRefused ? "refused" : e instanceof Error ? e.message.slice(0, 120) : "failed";
    must(await db().from("hl_ai_requests").update({ status: "refunded", error: reason, tokens_in: failUsage.tokensIn, tokens_out: failUsage.tokensOut, est_cost_usd: estimateCostUsd(failUsage) }).eq("id", req.id));
    if (e instanceof AiRefused) throw refusal(e.message_ar, e.message_ar);
    if (e instanceof AiNotConfigured) throw E.notConfigured("Healthy AI");
    if (e instanceof Error && e.message === "timeout") throw new HttpError(504, "ai_timeout", "الرد تأخّر أكثر من اللازم، فأعدنا لك الكريدت تلقائيًا. حاول مرة أخرى.", "The answer took too long, so your credit was refunded automatically. Please try again.");
    throw new HttpError(502, "ai_failed", "تعذّر توليد أفكار صالحة هذه المرة. أعدنا لك الكريدت تلقائيًا، جرّب صورة أوضح أو اكتب المكونات.", "We couldn't produce valid ideas this time. Your credit was refunded automatically; try a clearer photo or type the ingredients.");
  }
}

/** One-tap refinements of a saved result are free but capped: 5 per result and 15 per day, one at a time. */
export const REFINE_LIMITS = { perResult: 5, perDay: 15 } as const;

/**
 * "Make it cheaper / meatless / lighter / more protein / quicker / swap an ingredient" for a saved recipe, and
 * "easier / harder / shorter" for a workout. The original stays untouched: the change is saved as a new result.
 */
export async function refineResult(a: Auth, id: string, action: unknown, noteIn: unknown, uiLang?: unknown) {
  const forRecipe = isRecipeRefine(action);
  if (!forRecipe && !isWorkoutRefine(action)) throw E.bad();
  const row = must(await db().from("hl_recipes").select("id,username,title,content").eq("id", id).maybeSingle()) as { id: string; username: string; content: CoachContent } | null;
  if (!row || row.username !== a.username) throw E.notFound();
  const kind = row.content?.kind ?? "recipe";
  if (forRecipe ? kind !== "recipe" || !row.content.recipe : kind !== "workout" || !row.content.card) throw E.bad("هذا التعديل غير متاح لهذا النوع.", "This change isn't available for this type.");
  const note = action === "swap" ? cleanNote(noteIn) : "";
  if (action === "swap" && note.length < 2) throw E.bad("اكتب اسم المكوّن اللي عايز تبدله.", "Type the ingredient you want to replace.");
  if (!aiConfigured()) throw E.notConfigured("Healthy AI");

  const since = new Date(Date.now() - 86400_000).toISOString();
  const mine = () => db().from("hl_ai_requests").select("id", { count: "exact", head: true }).eq("username", a.username).eq("type", "follow-up").gte("created_at", since);
  const [day, perResult] = await Promise.all([mine(), mine().like("input_summary", `%${id}%`)]);
  if ((perResult.count ?? 0) >= REFINE_LIMITS.perResult) throw new HttpError(429, "refine_limit", "وصلت للحد الأقصى من التعديلات على هذه النتيجة اليوم. اطلب نتيجة جديدة أو جرّب غدًا.", "You've reached today's limit of changes on this result. Ask for a new one or try tomorrow.");
  if ((day.count ?? 0) >= REFINE_LIMITS.perDay) throw new HttpError(429, "refine_limit", "وصلت للحد اليومي من التعديلات. جرّب غدًا.", "You've reached today's limit of changes. Try again tomorrow.");

  const req = must(await db().from("hl_ai_requests").insert({ username: a.username, type: "follow-up", input_summary: `[refine:${action as string}] ${id}`.slice(0, 200), credit_cost: 0, status: "pending" }).select("id").single()) as { id: string };
  await assertSoleInFlight(a.username, req.id);
  const lang = asLang(uiLang, a.profile.language === "en" ? "en" : "ar");
  const ctx = { goal: a.profile.goal, conditions: a.profile.conditions, lang, prefs: prefsFromProfile(a.profile) };
  let usage: Usage = { tokensIn: 0, tokensOut: 0, searches: 0 };
  try {
    const tracked = await trackUsage(() => withDeadline<Recipe | Card>(forRecipe ? refineRecipe(row.content.recipe!, action as never, note, ctx) : refineWorkout(row.content.card!, action as never, ctx)));
    usage = tracked.usage;
    const out = tracked.result;
    const content = wrapContent(forRecipe ? "recipe" : "workout", out, a.profile.conditions);
    const saved = must(
      await db().from("hl_recipes").insert({ username: a.username, title: (out as { name: string }).name, content, source_request_id: req.id }).select("id,title,content,shared,like_count,save_count,created_at,username").single(),
    );
    must(await db().from("hl_ai_requests").update({ status: "completed", tokens_in: usage.tokensIn, tokens_out: usage.tokensOut, est_cost_usd: estimateCostUsd(usage) }).eq("id", req.id));
    return saved;
  } catch (e) {
    const failUsage = (e as { usage?: Usage }).usage ?? usage;
    must(await db().from("hl_ai_requests").update({ status: "failed", error: e instanceof Error ? e.message.slice(0, 120) : "failed", tokens_in: failUsage.tokensIn, tokens_out: failUsage.tokensOut, est_cost_usd: estimateCostUsd(failUsage) }).eq("id", req.id));
    if (e instanceof AiNotConfigured) throw E.notConfigured("Healthy AI");
    if (e instanceof Error && e.message === "timeout") throw new HttpError(504, "ai_timeout", "التعديل تأخّر أكثر من اللازم. حاول مرة أخرى.", "The change took too long. Please try again.");
    throw new HttpError(502, "ai_failed", "تعذّر تنفيذ هذا التعديل. جرّب تعديلًا آخر.", "We couldn't make that change. Try another one.");
  }
}

/** Start an AI workout (today) or 7-day challenge as a tracked challenge on the Today page. One AI challenge at a time. */
export async function trackResult(a: Auth, id: string) {
  const row = must(await db().from("hl_recipes").select("id,username,content").eq("id", id).maybeSingle()) as { id: string; username: string; content: CoachContent } | null;
  if (!row || row.username !== a.username) throw E.notFound();
  const kind = row.content?.kind;
  if ((kind !== "workout" && kind !== "challenge") || !row.content.card) throw E.bad("هذا النوع لا يمكن تتبّعه.", "This type can't be tracked.");
  const card = row.content.card;
  const days = kind === "challenge" ? 7 : 1;
  const chId = `ai_${id}`;
  const upcoming = must(await db().from("hl_user_challenges").select("challenge_id").eq("username", a.username).gte("date", a.today).eq("status", "assigned").limit(60)) as { challenge_id: string }[];
  const open = upcoming.filter((r) => r.challenge_id.startsWith("ai_"));
  if (open.some((r) => r.challenge_id === chId)) return { started: false, already: true, days };
  if (open.length) throw E.bad("عندك تحدٍّ من Healthy AI شغّال بالفعل. أنهِه أولًا.", "You already have a Healthy AI challenge running. Finish it first.");
  const title = card.name.slice(0, 80);
  must(await db().from("hl_challenges").upsert({ id: chId, type: "custom", title_ar: title, title_en: title, target_value: days > 1 ? days : card.duration_min ?? null, unit: days > 1 ? "days" : "min", active: false }, { onConflict: "id" }));
  must(await db().from("hl_user_challenges").upsert(Array.from({ length: days }, (_, i) => ({ username: a.username, challenge_id: chId, date: addDays(a.today, i), status: "assigned" })), { onConflict: "username,date,challenge_id", ignoreDuplicates: true }));
  return { started: true, already: false, days };
}
