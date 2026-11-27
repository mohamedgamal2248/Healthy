import { after } from "next/server";
import { dailyWaterCups } from "@/lib/nutrition";
import { STREAK_MILESTONES, streakMilestoneText } from "@/lib/reminder";
import { notifyEvent } from "./events";
import { db, must } from "./supabase";
import { ensureSeeded } from "./seed";
import { grantTrial } from "./credits";
import { REFERRAL_MIN_STREAK, rewardReferralIfAny } from "./referral";
import { E } from "./http";
import type { Auth } from "./auth";
import { applyCompletion, effectiveStreak, streakBadges, type StreakState } from "@/lib/streak";
import { addDays, dayDiff, hash } from "@/lib/dates";

export type ChallengeRow = { id: string; type: string; title_ar: string; title_en: string; target_value: number | null; unit: string | null; active: boolean };
export type TodayChallenge = { id: string; challenge_id: string; status: "assigned" | "completed"; type: string; title_ar: string; title_en: string; target_value: number | null; unit: string | null };

const DAILY_COUNT = 3;

let poolCache: { at: number; rows: ChallengeRow[] } | null = null;
let poolLoading: Promise<ChallengeRow[]> | null = null;
export const invalidatePoolCache = () => { poolCache = null; };
async function activePool(): Promise<ChallengeRow[]> {
  if (poolCache && Date.now() - poolCache.at < 60_000) return poolCache.rows;
  poolLoading ??= (async () => {
    await ensureSeeded();
    const rows = must(await db().from("hl_challenges").select("*").eq("active", true).order("id")) as ChallengeRow[];
    poolCache = { at: Date.now(), rows };
    return rows;
  })().finally(() => { poolLoading = null; });
  return poolLoading;
}

/** Deterministic pick of N challenges with distinct types where possible. */
export function pickChallenges(pool: ChallengeRow[], seed: string, n: number, exclude: Set<string> = new Set()): ChallengeRow[] {
  const sorted = pool.filter((c) => !exclude.has(c.id)).sort((a, b) => hash(seed + a.id) - hash(seed + b.id));
  const out: ChallengeRow[] = [];
  const types = new Set<string>();
  for (const c of sorted) {
    if (out.length === n) break;
    if (!types.has(c.type)) {
      out.push(c);
      types.add(c.type);
    }
  }
  for (const c of sorted) {
    if (out.length === n) break;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

async function rowsForDay(username: string, date: string) {
  return must(
    await db().from("hl_user_challenges").select("id, challenge_id, status, challenges:hl_challenges(type,title_ar,title_en,target_value,unit)").eq("username", username).eq("date", date).order("created_at"),
  ) as unknown as { id: string; challenge_id: string; status: "assigned" | "swapped" | "completed"; challenges: Omit<ChallengeRow, "id" | "active"> }[];
}

/** Water challenges use the user's own daily water target, so Today, the plan and Progress show one number. */
function personalise(c: TodayChallenge, a: Auth): TodayChallenge {
  if (c.type !== "water" || !a.profile.weight_kg) return c;
  const cups = dailyWaterCups(Number(a.profile.weight_kg));
  return { ...c, target_value: cups, title_ar: `اشرب ${cups.toLocaleString("ar-EG")} أكواب مياه`, title_en: `Drink ${cups} cups of water` };
}

/** Assign today's 3 challenges on first visit of the local day. */
export async function ensureToday(a: Auth) {
  let rows = await rowsForDay(a.username, a.today);
  // Days that only hold the user's own AI challenge still get the normal daily picks.
  if (!rows.some((r) => !r.challenge_id.startsWith("ai_"))) {
    const pool = await activePool();
    if (pool.length === 0) return { rows: [], swapUsed: false };
    const picks = pickChallenges(pool, `${a.username}:${a.today}`, DAILY_COUNT);
    must(
      await db().from("hl_user_challenges").upsert(
        picks.map((c) => ({ username: a.username, challenge_id: c.id, date: a.today, status: "assigned" })),
        { onConflict: "username,date,challenge_id", ignoreDuplicates: true },
      ),
    );
    rows = await rowsForDay(a.username, a.today);
  }
  const swapUsed = rows.some((r) => r.status === "swapped");
  const list: TodayChallenge[] = rows
    .filter((r) => r.status !== "swapped")
    .map((r) => personalise({ id: r.id, challenge_id: r.challenge_id, status: r.status as "assigned" | "completed", ...r.challenges }, a));
  return { rows: list, swapUsed };
}

export async function swapChallenge(a: Auth, userChallengeId: string) {
  const { rows, swapUsed } = await ensureToday(a);
  if (swapUsed) throw E.bad("استخدمت التبديل المسموح به اليوم (تبديل واحد في اليوم).", "You already used today's single swap.");
  const target = rows.find((r) => r.id === userChallengeId);
  if (!target) throw E.notFound();
  if (target.status === "completed") throw E.bad("لا يمكن تبديل تحدٍّ أنجزته بالفعل.", "You can't swap a challenge you already completed.");
  if (target.challenge_id.startsWith("ai_")) throw E.bad("لا يمكن تبديل تحدٍّ من Healthy AI.", "A Healthy AI challenge can't be swapped.");
  const pool = await activePool();
  const all = must(await db().from("hl_user_challenges").select("challenge_id").eq("username", a.username).eq("date", a.today)) as { challenge_id: string }[];
  const used = new Set(all.map((r) => r.challenge_id));
  const otherTypes = new Set(rows.filter((r) => r.id !== target.id).map((r) => r.type));
  const candidates = pool.filter((c) => !used.has(c.id));
  const preferred = candidates.filter((c) => !otherTypes.has(c.type));
  const pick = pickChallenges(preferred.length ? preferred : candidates, `${a.username}:${a.today}:swap`, 1)[0];
  if (!pick) throw E.bad("لا توجد تحديات بديلة حاليًا.", "No replacement challenge is available right now.");
  must(await db().from("hl_user_challenges").update({ status: "swapped" }).eq("id", target.id).eq("username", a.username));
  must(await db().from("hl_user_challenges").insert({ username: a.username, challenge_id: pick.id, date: a.today, status: "assigned" }));
}

export async function loadStreak(username: string): Promise<StreakState> {
  const s = must(await db().from("hl_streaks").select("*").eq("username", username).maybeSingle()) as { current_streak: number; longest_streak: number; last_completed_date: string | null; total_completed: number; freeze_used_on: string | null } | null;
  return { current: s?.current_streak ?? 0, longest: s?.longest_streak ?? 0, last: s?.last_completed_date ?? null, total: s?.total_completed ?? 0, freezeUsed: s?.freeze_used_on ?? null };
}

async function completedCountOfType(username: string, type: string): Promise<number> {
  const ids = (must(await db().from("hl_challenges").select("id").eq("type", type)) as { id: string }[]).map((c) => c.id);
  if (!ids.length) return 0;
  const res = await db().from("hl_user_challenges").select("id", { count: "exact", head: true }).eq("username", username).eq("status", "completed").in("challenge_id", ids);
  return res.count ?? 0;
}

export async function awardBadges(username: string, current: number): Promise<string[]> {
  const keys = new Set(streakBadges(current));
  const [sugar, water, walk, steps] = await Promise.all(["no_sugar", "water", "walk", "steps"].map((t) => completedCountOfType(username, t)));
  if (sugar >= 7) keys.add("sugar_hero");
  if (water >= 10) keys.add("water_champ");
  if (walk + steps >= 10) keys.add("walker");
  if (!keys.size) return [];
  const have = new Set((must(await db().from("hl_badges").select("badge_key").eq("username", username)) as { badge_key: string }[]).map((b) => b.badge_key));
  const fresh = [...keys].filter((k) => !have.has(k));
  if (fresh.length) must(await db().from("hl_badges").upsert(fresh.map((k) => ({ username, badge_key: k })), { onConflict: "username,badge_key", ignoreDuplicates: true }));
  return fresh;
}

/** Server-side check-off: only today's own assigned challenge; streak and badges are computed here. */
export async function completeChallenge(a: Auth, userChallengeId: string) {
  const row = must(await db().from("hl_user_challenges").select("id,status,date").eq("id", userChallengeId).eq("username", a.username).maybeSingle()) as { id: string; status: string; date: string } | null;
  if (!row) throw E.notFound();
  if (row.date !== a.today) throw E.bad("يمكنك إنجاز تحديات اليوم فقط.", "You can only complete today's challenges.");
  if (row.status === "completed") return { newBadges: [] as string[], starterReward: false, referralReward: false };
  if (row.status !== "assigned") throw E.bad();

  // Conditional update guards against double taps / concurrent requests counting twice.
  const upd = must(
    await db().from("hl_user_challenges").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", row.id).eq("status", "assigned").select("id"),
  ) as { id: string }[];
  if (!upd.length) return { newBadges: [] as string[], starterReward: false, referralReward: false };

  const prev = await loadStreak(a.username);
  const next = applyCompletion(prev, a.today);
  must(
    await db().from("hl_streaks").upsert({ username: a.username, current_streak: next.current, longest_streak: next.longest, last_completed_date: next.last, total_completed: next.total, freeze_used_on: next.freezeUsed ?? null }, { onConflict: "username" }),
  );
  const newBadges = await awardBadges(a.username, next.current);
  // Celebrate streak milestones once each (the notice is sent after the response, so it never slows the tap).
  if ((STREAK_MILESTONES as readonly number[]).includes(next.current)) {
    const days = next.current, record = prev.longest < next.current;
    after(() => notifyEvent(a.username, `streak_${days}`, (lang) => streakMilestoneText({ days, record, lang })));
  }
  // Starter challenge: 7 days in a row earns the AI credits, once (unique ledger index guarantees it).
  let starterReward = false;
  if (next.current >= 7 && a.profile.kyc_verified) starterReward = await grantTrial(a.username);
  // Invite reward: checked once per day (first completion of the day) once the friend has a real streak.
  const firstToday = prev.last !== a.today;
  const referralReward = firstToday && next.current >= REFERRAL_MIN_STREAK && a.profile.kyc_verified ? await rewardReferralIfAny(a.username).catch(() => false) : false;
  return { newBadges, starterReward, referralReward };
}

export async function lastActivityDate(username: string): Promise<string | null> {
  return lastActivityFrom(username, await loadStreak(username));
}
async function lastActivityFrom(username: string, s: StreakState): Promise<string | null> {
  const h = must(await db().from("hl_habit_logs").select("date").eq("username", username).order("date", { ascending: false }).limit(1)) as { date: string }[];
  const dates = [s.last, h[0]?.date].filter(Boolean) as string[];
  return dates.sort().pop() ?? null;
}

/** Pure version for callers that already have the streak and the last habit date. */
export function reminderFrom(today: string, streakLast: string | null, lastHabit: string | null): "none" | "morning" | "inactive" {
  const last = [streakLast, lastHabit].filter(Boolean).sort().pop() as string | undefined;
  return last && dayDiff(today, last) >= 2 ? "inactive" : "morning";
}

export async function reminderState(a: Auth, streak?: StreakState): Promise<"none" | "morning" | "inactive"> {
  const last = streak ? await lastActivityFrom(a.username, streak) : await lastActivityDate(a.username);
  if (last && dayDiff(a.today, last) >= 2) return "inactive";
  return "morning";
}

export async function recentCompletedCount(username: string, from: string, to: string): Promise<number> {
  const res = await db().from("hl_user_challenges").select("id", { count: "exact", head: true }).eq("username", username).eq("status", "completed").gte("date", from).lte("date", to);
  return res.count ?? 0;
}

export { effectiveStreak, addDays };
