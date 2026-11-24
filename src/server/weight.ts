import { db, must } from "./supabase";
import type { Auth } from "./auth";
import { weekStart } from "@/lib/dates";

/**
 * The one way a weight enters the system. Every entry is a dated log row, and the profile always carries the LATEST one, so
 * Profile and Progress can never disagree. Only the first entry of a week is "official" (it feeds the diet plan).
 */
export async function logWeight(a: Auth, kg: number): Promise<{ official: boolean }> {
  const week = weekStart(a.today);
  const official = must(await db().from("hl_weight_logs").select("id").eq("username", a.username).eq("week_start", week).eq("is_official", true).maybeSingle());
  const isOfficial = !official;
  must(await db().from("hl_weight_logs").insert({ username: a.username, weight_kg: kg, logged_date: a.today, is_official: isOfficial, week_start: week }));
  must(await db().from("hl_profiles").update({ weight_kg: kg, updated_at: new Date().toISOString() }).eq("username", a.username));
  return { official: isOfficial };
}

/** Latest dated weight (any entry): what every screen shows as "current weight". */
export async function latestWeight(username: string): Promise<{ kg: number; date: string } | null> {
  const r = must(await db().from("hl_weight_logs").select("weight_kg,logged_date").eq("username", username).order("logged_date", { ascending: false }).order("created_at", { ascending: false }).limit(1)) as { weight_kg: number; logged_date: string }[];
  return r[0] ? { kg: Number(r[0].weight_kg), date: r[0].logged_date } : null;
}
