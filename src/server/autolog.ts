import { db } from "./supabase";
import type { Auth } from "./auth";
import { weekStart } from "@/lib/dates";

export type PlanSlotRow = { type: string; source: string; meal_id?: string | null; name_ar?: string; name_en?: string; servings: number; calories: number; protein_g: number };
export type PlanToday = { day: { date: string; slots: PlanSlotRow[]; total_kcal: number } | null };

/** Today's day of the person's weekly plan (one small query). Plan meals only count in the diary after the person confirms them. */
export async function planToday(a: Auth): Promise<PlanToday> {
  const r = await db().rpc("hl_plan_today", { p_user: a.username, p_week: weekStart(a.today), p_date: a.today });
  if (r.error || !r.data) return { day: null };
  const d = r.data as { day: PlanToday["day"] };
  return { day: d.day && Array.isArray(d.day.slots) ? d.day : null };
}
