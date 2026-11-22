import { db, must } from "./supabase";
import { E, HttpError } from "./http";
import type { Auth } from "./auth";
import { addDays, weekStart } from "@/lib/dates";
import { bmr, dailyCalories, dailyWaterCups, weeklyAdjustment, type Goal, type Activity, type Sex } from "@/lib/nutrition";
import { buildWeekPlan, requiredTags, type PlanMealRef, type PlanDay } from "@/lib/planner";
import { hasActivePlan, refundCredit, spendCredit } from "./credits";
import { aiConfigured } from "./ai/provider";
import { generateRecipe } from "./ai/recipe";
import { cautionsFor, hasMedicalFlag, DOCTOR_NOTE_AR, DOCTOR_NOTE_EN } from "./ai/safety";
import { PLAN_REGENERATE_COST } from "@/config/pricing";
import { effectiveStreak } from "@/lib/streak";
import { loadStreak, recentCompletedCount } from "./challenges";

export type StoredPlan = {
  id: string; week_start: string; daily_calorie_target: number; daily_water_target: number; adjustment_kcal: number; created_at: string;
  plan: { days: PlanDay[]; notes: { gaps_unfilled: number; ai_filled: number } };
};

type Weight = { weight_kg: number; logged_date: string; is_official: boolean; created_at: string };

async function officialWeights(username: string, limit = 3): Promise<Weight[]> {
  return must(await db().from("hl_weight_logs").select("weight_kg,logged_date,is_official,created_at").eq("username", username).eq("is_official", true).order("logged_date", { ascending: false }).limit(limit)) as Weight[];
}

export async function planForWeek(username: string, week: string): Promise<StoredPlan | null> {
  return must(await db().from("hl_diet_plans").select("*").eq("username", username).eq("week_start", week).maybeSingle()) as StoredPlan | null;
}

/** The current plan plus safety text for the user's declared conditions. */
export function planSafety(conditions: string[]) {
  return { cautions: cautionsFor(conditions), doctor_note: hasMedicalFlag(conditions) ? { ar: DOCTOR_NOTE_AR, en: DOCTOR_NOTE_EN } : null };
}

async function generate(a: Auth, week: string, kind: "first" | "refresh" | "regenerate", requestId: string | null) {
  const p = a.profile;
  if (!p.age || !p.sex || !p.height_cm || !p.goal || !p.activity) {
    throw new HttpError(400, "profile_incomplete", "أكمل بيانات ملفك الصحي (العمر، النوع، الطول، الوزن، الهدف، النشاط) لإنشاء خطتك.", "Complete your health profile (age, sex, height, weight, goal, activity) to build your plan.");
  }
  const weights = await officialWeights(a.username, 2);
  const weightKg = weights[0]?.weight_kg ?? p.weight_kg;
  if (!weightKg) throw new HttpError(400, "profile_incomplete", "سجّل وزنك أولًا لإنشاء خطتك.", "Log your weight first to build your plan.");

  const prev = await planForWeek(a.username, addDays(week, -7));
  const current = await planForWeek(a.username, week);
  const baseAdj = (kind === "regenerate" ? current?.adjustment_kcal : prev?.adjustment_kcal) ?? 0;
  const adjustment = kind === "refresh" && weights.length >= 2 ? weeklyAdjustment(p.goal as Goal, Number(weights[1].weight_kg), Number(weights[0].weight_kg), baseAdj) : baseAdj;

  const input = { weightKg: Number(weightKg), heightCm: Number(p.height_cm), age: p.age, sex: p.sex as Sex, goal: p.goal as Goal, activity: p.activity as Activity, conditions: p.conditions, adjustment };
  const calorieTarget = dailyCalories(input); // never below 1,200 kcal
  const water = dailyWaterCups(input.weightKg);

  const meals = must(await db().from("hl_meals").select("id,meal_type,name_ar,name_en,calories,protein_g,tags").eq("active", true)) as PlanMealRef[];
  const built = buildWeekPlan({ meals, calorieTarget, conditions: p.conditions, goal: p.goal, weekStart: week, seed: `${a.username}:${week}` });

  // Complete slots the catalogue cannot fill (e.g. no meal carries the required condition tags) with AI.
  let aiFilled = 0;
  if (built.gaps.length && aiConfigured()) {
    const need = requiredTags(p.conditions);
    const typeAr = { breakfast: "فطار", lunch: "غدا", dinner: "عشا" } as const;
    const results = await Promise.allSettled(
      built.gaps.slice(0, 6).map((g) =>
        generateRecipe(`وصفة ${typeAr[g.type]} بحوالي ${g.kcal} سعرة حرارية${need.includes("low_salt") ? "، قليلة الملح" : ""}${need.includes("diabetes_friendly") ? "، مناسبة لمريض السكر" : ""}`, { goal: p.goal, conditions: p.conditions }),
      ),
    );
    results.forEach((r, i) => {
      if (r.status !== "fulfilled") return;
      const g = built.gaps[i];
      built.days[g.dayIndex].slots.push({ type: g.type, source: "ai", name_ar: r.value.name, name_en: r.value.name, servings: 1, calories: Math.round(r.value.calories), protein_g: Math.round(r.value.protein), recipe: r.value });
      aiFilled++;
    });
    for (const d of built.days) {
      const order = { breakfast: 0, lunch: 1, dinner: 2 } as const;
      d.slots.sort((x, y) => order[x.type] - order[y.type]);
      d.total_kcal = d.slots.reduce((s, x) => s + x.calories, 0);
    }
  }
  const unfilled = built.gaps.length - aiFilled;
  const planJson = { days: built.days, notes: { gaps_unfilled: unfilled, ai_filled: aiFilled } };

  const row = must(
    await db().from("hl_diet_plans").upsert({ username: a.username, week_start: week, daily_calorie_target: calorieTarget, daily_water_target: water, adjustment_kcal: adjustment, plan: planJson, status: "active", created_at: new Date().toISOString() }, { onConflict: "username,week_start" }).select("*").single(),
  ) as StoredPlan;

  if (aiFilled > 0 || requestId) {
    // Audit trail for AI usage inside plan generation (credit cost is recorded on the request itself).
    if (requestId) must(await db().from("hl_ai_requests").update({ status: "completed", output: { week, calorieTarget, aiFilled } }).eq("id", requestId));
    else must(await db().from("hl_ai_requests").insert({ username: a.username, type: "plan", input_summary: `plan ${week} (ai gap fill x${aiFilled})`, credit_cost: 0, status: "completed" }));
  }
  return row;
}

/**
 * Subscribers only. First plan and weekly refresh are free; regenerating mid-week costs 1 credit
 * (refunded if generation fails).
 */
export async function createPlan(a: Auth, mode: "auto" | "regenerate"): Promise<StoredPlan> {
  if (!(await hasActivePlan(a.username))) throw E.needPlan();
  const week = weekStart(a.today);
  const existing = await planForWeek(a.username, week);

  if (mode === "regenerate" && existing) {
    const req = must(await db().from("hl_ai_requests").insert({ username: a.username, type: "plan", input_summary: `regenerate ${week}`, credit_cost: PLAN_REGENERATE_COST, status: "pending" }).select("id").single()) as { id: string };
    const kind = await spendCredit(a.username, req.id);
    if (!kind) {
      must(await db().from("hl_ai_requests").update({ status: "failed", credit_cost: 0, error: "no_credits" }).eq("id", req.id));
      throw E.noCredits();
    }
    try {
      return await generate(a, week, "regenerate", req.id);
    } catch (e) {
      await refundCredit(req.id);
      await db().from("hl_ai_requests").update({ status: "refunded", error: e instanceof Error ? e.message.slice(0, 120) : "failed" }).eq("id", req.id);
      throw e;
    }
  }

  if (!existing) return generate(a, week, "first", null);

  // Weekly refresh: a new official weight logged after the current plan was created -> plan for next week.
  const w = (await officialWeights(a.username, 1))[0];
  const next = addDays(week, 7);
  if (w && new Date(w.created_at) > new Date(existing.created_at)) {
    return (await planForWeek(a.username, next)) ?? (await generate(a, next, "refresh", null));
  }
  return existing;
}

// ------------------------------------------------------------------ weekly report
export async function buildReport(a: Auth, week: string) {
  const end = addDays(week, 6);
  const weights = must(await db().from("hl_weight_logs").select("weight_kg,logged_date,is_official").eq("username", a.username).lte("logged_date", end).order("logged_date", { ascending: false }).limit(40)) as { weight_kg: number; logged_date: string; is_official: boolean }[];
  const inWeek = weights.filter((w) => w.logged_date >= week);
  const before = weights.find((w) => w.logged_date < week && w.is_official) ?? weights.find((w) => w.logged_date < week);
  const cur = inWeek.find((w) => w.is_official) ?? inWeek[0];
  const change = cur && before ? Math.round((Number(cur.weight_kg) - Number(before.weight_kg)) * 10) / 10 : null;
  const streak = await loadStreak(a.username);
  const completed = await recentCompletedCount(a.username, week, end);
  const favs = must(await db().from("hl_favourites").select("source_id,created_at").eq("username", a.username).eq("source_type", "meal").gte("created_at", `${week}T00:00:00Z`).order("created_at", { ascending: false }).limit(1)) as { source_id: string }[];
  const fav = favs[0] ? (must(await db().from("hl_meals").select("id,name_ar,name_en").eq("id", favs[0].source_id).maybeSingle()) as { id: string; name_ar: string; name_en: string } | null) : null;
  const habits = must(await db().from("hl_habit_logs").select("water_cups").eq("username", a.username).gte("date", week).lte("date", end)) as { water_cups: number | null }[];
  const waters = habits.map((h) => h.water_cups).filter((n): n is number => n !== null);
  const avgWater = waters.length ? Math.round((waters.reduce((s, n) => s + n, 0) / waters.length) * 10) / 10 : null;

  // One practical, rule-based tip (no medical claims).
  let tip = { ar: "استمر في تحديات اليوم، فالاستمرارية أهم من الكمال.", en: "Keep going with today's challenges: consistency beats perfection." };
  if (completed < 7) tip = { ar: "جرّب أن تنجز تحديًا واحدًا على الأقل كل يوم الأسبوع القادم للحفاظ على السلسلة.", en: "Aim for at least one challenge every day next week to protect your streak." };
  else if (avgWater !== null && avgWater < 6) tip = { ar: "حاول زيادة المياه: ضع زجاجة بجانبك واشرب كوبًا مع كل وجبة.", en: "Try drinking more water: keep a bottle nearby and have a cup with each meal." };
  else if (change !== null && a.profile.goal === "lose" && change >= 0) tip = { ar: "ركّز الأسبوع القادم على الخضار في كل وجبة والمشي بعد الغدا.", en: "Next week, focus on vegetables with every meal and a walk after lunch." };

  return { week_start: week, weight_change: change, current_weight: cur ? Number(cur.weight_kg) : null, streak: effectiveStreak(streak, a.today), challenges_completed: completed, favourite_meal: fav, avg_water: avgWater, tip_en: tip.en, tip_ar: tip.ar };
}

export async function saveReport(a: Auth, week: string) {
  if (!(await hasActivePlan(a.username))) throw E.needPlan();
  const r = await buildReport(a, week);
  const { tip_ar, tip_en, ...summary } = r;
  void tip_en;
  must(await db().from("hl_weekly_reports").upsert({ username: a.username, week_start: week, summary: { ...summary, tip_en }, tip: tip_ar }, { onConflict: "username,week_start" }));
  return r;
}

export { bmr };
