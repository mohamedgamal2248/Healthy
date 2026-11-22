import { db, must } from "./supabase";
import type { Auth } from "./auth";
import { GROUP_DEFAULTS } from "@/data/challenges";
import { addDays, dayNumber, hash, weekStart } from "@/lib/dates";

export type Group = { id: string; week_start: string; challenge_id: string | null; title_ar: string; title_en: string };

/** This week's shared challenge: admin-created, otherwise a default rotated by week. */
export async function currentGroup(today: string): Promise<Group> {
  const week = weekStart(today);
  const ex = must(await db().from("hl_group_challenges").select("*").eq("week_start", week).maybeSingle()) as Group | null;
  if (ex) return ex;
  const d = GROUP_DEFAULTS[Math.floor(dayNumber(week) / 7) % GROUP_DEFAULTS.length];
  const ins = await db().from("hl_group_challenges").upsert({ week_start: week, challenge_id: d.challenge_id, title_ar: d.title_ar, title_en: d.title_en }, { onConflict: "week_start", ignoreDuplicates: true });
  if (ins.error) throw new Error(ins.error.message);
  return must(await db().from("hl_group_challenges").select("*").eq("week_start", week).single()) as Group;
}

/** Reputation-only leaderboard: verified Pioneers who have not hidden themselves. No health data. */
export async function leaderboard(groupId: string) {
  const members = must(await db().from("hl_group_challenge_members").select("username,days_completed").eq("group_id", groupId).order("days_completed", { ascending: false }).limit(200)) as { username: string; days_completed: number }[];
  if (!members.length) return [];
  const names = members.map((m) => m.username);
  const [profiles, streaks] = await Promise.all([
    db().from("hl_profiles").select("username,kyc_verified,leaderboard_visible").in("username", names),
    db().from("hl_streaks").select("username,current_streak,last_completed_date").in("username", names),
  ]);
  const visible = new Set((must(profiles) as { username: string; kyc_verified: boolean; leaderboard_visible: boolean }[]).filter((p) => p.kyc_verified && p.leaderboard_visible).map((p) => p.username));
  const st = new Map((must(streaks) as { username: string; current_streak: number }[]).map((s) => [s.username, s.current_streak]));
  return members.filter((m) => visible.has(m.username)).slice(0, 50).map((m, i) => ({ rank: i + 1, username: m.username, verified: true, days: m.days_completed, streak: st.get(m.username) ?? 0 }));
}

/** Authors who are KYC-verified, not deleted and did not hide themselves from community surfaces. */
async function visibleAuthors(names: string[]): Promise<Set<string>> {
  const uniq = [...new Set(names)];
  if (!uniq.length) return new Set();
  const rows = must(await db().from("hl_profiles").select("username,kyc_verified,leaderboard_visible,deleted_at").in("username", uniq)) as { username: string; kyc_verified: boolean; leaderboard_visible: boolean; deleted_at: string | null }[];
  return new Set(rows.filter((p) => p.kyc_verified && p.leaderboard_visible && !p.deleted_at).map((p) => p.username));
}

/** Top shared recipes of the last 7 days by likes + saves from verified users. */
export async function topRecipes(a: Auth) {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const [likes, saves] = await Promise.all([
    db().from("hl_recipe_likes").select("recipe_id,username").gte("created_at", since).limit(2000),
    db().from("hl_favourites").select("source_id,username").eq("source_type", "recipe").gte("created_at", since).limit(2000),
  ]);
  const actors = new Set<string>();
  const L = must(likes) as { recipe_id: string; username: string }[];
  const S = must(saves) as { source_id: string; username: string }[];
  L.forEach((l) => actors.add(l.username));
  S.forEach((s) => actors.add(s.username));
  const verified = actors.size ? new Set((must(await db().from("hl_profiles").select("username").in("username", [...actors]).eq("kyc_verified", true)) as { username: string }[]).map((p) => p.username)) : new Set<string>();
  const score = new Map<string, number>();
  L.filter((l) => verified.has(l.username)).forEach((l) => score.set(l.recipe_id, (score.get(l.recipe_id) ?? 0) + 1));
  S.filter((s) => verified.has(s.username)).forEach((s) => score.set(s.source_id, (score.get(s.source_id) ?? 0) + 1));
  const ids = [...score.keys()];
  if (!ids.length) return [];
  const recipes = must(await db().from("hl_recipes").select("id,username,title,content,like_count,save_count").in("id", ids).eq("shared", true)) as { id: string; username: string; title: string; content: { recipe: { calories: number; protein: number } }; like_count: number; save_count: number }[];
  const [myLikes, myFavs] = await Promise.all([
    db().from("hl_recipe_likes").select("recipe_id").eq("username", a.username).in("recipe_id", ids),
    db().from("hl_favourites").select("source_id").eq("username", a.username).eq("source_type", "recipe").in("source_id", ids),
  ]);
  const liked = new Set((must(myLikes) as { recipe_id: string }[]).map((r) => r.recipe_id));
  const saved = new Set((must(myFavs) as { source_id: string }[]).map((r) => r.source_id));
  const okAuthors = await visibleAuthors(recipes.map((r) => r.username));
  return recipes
    .filter((r) => okAuthors.has(r.username))
    .map((r) => ({ id: r.id, title: r.title, author: r.username, calories: r.content?.recipe?.calories, protein: r.content?.recipe?.protein, likes: r.like_count, saves: r.save_count, score: score.get(r.id) ?? 0, liked: liked.has(r.id), saved: saved.has(r.id) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, 10);
}

export const TEAMS = [
  { key: "olive", ar: "فريق الزيتون", en: "Team Olive" },
  { key: "gold", ar: "فريق الذهب", en: "Team Gold" },
] as const;
export const teamOf = (username: string) => TEAMS[hash(username) % 2].key;

/** Two teams (assigned by a stable hash): weekly total of check-in days. Reputation only. */
export async function teamBoard(groupId: string, me: string) {
  const members = must(await db().from("hl_group_challenge_members").select("username,days_completed").eq("group_id", groupId).limit(2000)) as { username: string; days_completed: number }[];
  const totals = { olive: { members: 0, days: 0 }, gold: { members: 0, days: 0 } };
  for (const m of members) { const t = teamOf(m.username); totals[t].members++; totals[t].days += m.days_completed; }
  return { teams: TEAMS.map((t) => ({ ...t, ...totals[t.key] })), myTeam: teamOf(me) };
}

/** Month ranking: check-in days in the current calendar month (verified + visible users only). */
export async function monthlyBoard(today: string) {
  const from = `${today.slice(0, 7)}-01`;
  const checks = must(await db().from("hl_group_challenge_checks").select("username").gte("date", from).lte("date", today).limit(20000)) as { username: string }[];
  const count = new Map<string, number>();
  checks.forEach((c) => count.set(c.username, (count.get(c.username) ?? 0) + 1));
  const names = [...count.keys()];
  if (!names.length) return [];
  const profs = must(await db().from("hl_profiles").select("username,kyc_verified,leaderboard_visible").in("username", names)) as { username: string; kyc_verified: boolean; leaderboard_visible: boolean }[];
  const ok = new Set(profs.filter((p) => p.kyc_verified && p.leaderboard_visible).map((p) => p.username));
  return names.filter((n) => ok.has(n)).sort((a, b) => (count.get(b) ?? 0) - (count.get(a) ?? 0)).slice(0, 50).map((n, i) => ({ rank: i + 1, username: n, verified: true, days: count.get(n) ?? 0, streak: 0 }));
}

/** Light counters for the engagement cards (no personal data). */
export async function groupSnapshot(username: string, today: string) {
  const g = await currentGroup(today);
  const [members, checks, me] = await Promise.all([
    db().from("hl_group_challenge_members").select("username", { count: "exact", head: true }).eq("group_id", g.id),
    db().from("hl_group_challenge_checks").select("username", { count: "exact", head: true }).eq("group_id", g.id).eq("date", today),
    db().from("hl_group_challenge_members").select("days_completed").eq("group_id", g.id).eq("username", username).maybeSingle(),
  ]);
  return { title_ar: g.title_ar, title_en: g.title_en, members: members.count ?? 0, checkedToday: checks.count ?? 0, joined: !!me.data, myDays: (me.data as { days_completed: number } | null)?.days_completed ?? 0 };
}

/** Newest shared recipes (so fresh content shows up even before it collects likes). */
export async function latestRecipes(a: Auth) {
  const rows = must(await db().from("hl_recipes").select("id,username,title,content,like_count,save_count,shared_at").eq("shared", true).order("shared_at", { ascending: false }).limit(10)) as { id: string; username: string; title: string; content: { recipe: { calories: number; protein: number } }; like_count: number; save_count: number }[];
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [myLikes, myFavs] = await Promise.all([
    db().from("hl_recipe_likes").select("recipe_id").eq("username", a.username).in("recipe_id", ids),
    db().from("hl_favourites").select("source_id").eq("username", a.username).eq("source_type", "recipe").in("source_id", ids),
  ]);
  const liked = new Set((must(myLikes) as { recipe_id: string }[]).map((r) => r.recipe_id));
  const saved = new Set((must(myFavs) as { source_id: string }[]).map((r) => r.source_id));
  const okAuthors = await visibleAuthors(rows.map((r) => r.username));
  return rows.filter((r) => okAuthors.has(r.username)).map((r) => ({ id: r.id, title: r.title, author: r.username, calories: r.content?.recipe?.calories, protein: r.content?.recipe?.protein, likes: r.like_count, saves: r.save_count, score: 0, liked: liked.has(r.id), saved: saved.has(r.id) }));
}

export { addDays };
