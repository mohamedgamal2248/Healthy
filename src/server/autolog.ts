import { db, must } from "./supabase";
import type { Auth } from "./auth";
import { MAX_ENTRIES_PER_DAY, resolveEntry, validPortion } from "./food";
import { weekStart } from "@/lib/dates";

export type PlanSlotRow = { type: string; source: string; meal_id?: string | null; name_ar?: string; name_en?: string; servings: number; calories: number; protein_g: number };
export type PlanToday = { day: { date: string; slots: PlanSlotRow[]; total_kcal: number } | null; filled: boolean };

/** Today's day of the person's weekly plan, and whether its meals were already put into the diary today. One small query. */
export async function planToday(a: Auth): Promise<PlanToday> {
  const r = await db().rpc("hl_plan_today", { p_user: a.username, p_week: weekStart(a.today), p_date: a.today });
  if (r.error || !r.data) return { day: null, filled: false };
  const d = r.data as PlanToday;
  return { day: d.day && Array.isArray(d.day.slots) ? d.day : null, filled: !!d.filled };
}

/**
 * Puts today's planned meals (main meals and snacks) into the diary, once per day, so the day's counters follow the plan. The entries
 * are marked "auto": the person can change a portion or delete any of them, and a deleted one is never added back. Nothing is added
 * when the person turned this off, when there is no plan for today, or when they already logged something themselves today.
 */
export async function autologToday(a: Auth): Promise<{ added: number }> {
  if (a.profile.plan_autolog === false) return { added: 0 };
  const p = await planToday(a);
  if (!p.day || p.filled || p.day.slots.length === 0) return { added: 0 };
  const claimed = must(await db().rpc("hl_autolog_claim", { p_user: a.username, p_date: a.today })) as boolean;
  if (!claimed) return { added: 0 };
  const own = await db().from("hl_food_log").select("id", { count: "exact", head: true }).eq("username", a.username).eq("date", a.today).eq("auto", false);
  if ((own.count ?? 0) > 0) return { added: 0 };

  const ar = a.profile.language === "ar";
  const rows: Record<string, unknown>[] = [];
  const base = Date.now();
  for (const s of p.day.slots.slice(0, MAX_ENTRIES_PER_DAY)) {
    const servings = validPortion(s.servings);
    let row: Record<string, unknown> | null = null;
    if (s.source === "catalogue" && s.meal_id) {
      try { row = { ...(await resolveEntry(a, { source: "meal", mealId: s.meal_id, portion: servings })), servings }; } catch { row = null; }
    }
    if (!row) {
      const name = ((ar ? s.name_ar : s.name_en) || s.name_en || s.name_ar || "").slice(0, 120);
      if (!name || !(s.calories >= 0)) continue;
      row = { name, calories: Math.min(5000, Math.round(s.calories)), protein_g: Math.max(0, Number(s.protein_g) || 0), carbs_g: null, fat_g: null, source: "manual", source_id: null, servings: 1 };
    }
    rows.push({ username: a.username, date: a.today, auto: true, created_at: new Date(base + rows.length).toISOString(), ...row });
  }
  if (!rows.length) return { added: 0 };
  must(await db().from("hl_food_log").insert(rows));
  return { added: rows.length };
}
