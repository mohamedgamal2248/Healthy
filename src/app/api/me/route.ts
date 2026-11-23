import { z } from "zod";
import { db, must } from "@/server/supabase";
import { ok, readJson, route, E } from "@/server/http";
import { adminUsernames, requireUser } from "@/server/auth";
import { getBalances } from "@/server/credits";
import { rateLimit } from "@/server/ratelimit";
import { validTz } from "@/lib/dates";

export const GET = route(async (req) => {
  const a = await requireUser(req);
  const balances = a.profile.kyc_verified ? await getBalances(a.username) : null;
  const { pi_uid: _uid, token_version: _tv, deleted_at: _d, created_at: _c, ...profile } = a.profile;
  void _uid; void _tv; void _d; void _c;
  return ok({ profile, balances, isAdmin: adminUsernames().includes(a.username.toLowerCase()) });
});

const Patch = z.object({
  age: z.number().int().min(5).max(120).nullable().optional(),
  sex: z.enum(["male", "female"]).nullable().optional(),
  weight_kg: z.number().min(20).max(400).nullable().optional(),
  height_cm: z.number().min(80).max(250).nullable().optional(),
  goal: z.enum(["lose", "gain", "maintain"]).nullable().optional(),
  activity: z.enum(["low", "medium", "high"]).nullable().optional(),
  conditions: z.array(z.enum(["diabetes", "hypertension", "pregnancy"])).max(3).optional(),
  language: z.enum(["ar", "en"]).optional(),
  timezone: z.string().max(60).optional(),
  leaderboard_visible: z.boolean().optional(),
  notify_pi: z.boolean().optional(),
  accept_disclaimer: z.boolean().optional(),
});

export const PATCH = route(async (req) => {
  const a = await requireUser(req);
  const parsed = Patch.safeParse(await readJson(req));
  if (!parsed.success) throw E.bad("بيانات الملف الصحي غير صالحة.", "Invalid profile data.");
  const { accept_disclaimer, ...fields } = parsed.data;
  const update: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
  const merged = { ...a.profile, ...fields };
  if (fields.timezone !== undefined && fields.timezone !== a.profile.timezone) {
    const last = a.profile.timezone_changed_at ? new Date(a.profile.timezone_changed_at).getTime() : 0;
    if (Date.now() - last < 7 * 86400_000) throw E.bad("يمكن تغيير المنطقة الزمنية مرة كل أسبوع.", "The time zone can be changed once a week.");
    update.timezone = validTz(fields.timezone);
    update.timezone_changed_at = new Date().toISOString();
  }
  if (accept_disclaimer) {
    if (!merged.age || !merged.goal) throw E.bad("العمر والهدف مطلوبان قبل الموافقة.", "Age and goal are required before accepting.");
    update.disclaimer_accepted_at = a.profile.disclaimer_accepted_at ?? new Date().toISOString();
  }
  must(await db().from("hl_profiles").update(update).eq("username", a.username));
  return ok({ ok: true });
});

/**
 * Delete account: erases health data, content and activity. Payment and credit-ledger rows are kept
 * (financial record) but are detached from any personal data. All issued sessions stop working.
 */
export const DELETE = route(async (req) => {
  const a = await requireUser(req);
  await rateLimit("delete", a.username, 3, 3600);
  const { confirm } = await readJson<{ confirm?: string }>(req);
  if ((confirm ?? "").toLowerCase() !== a.username.toLowerCase()) throw E.bad("اكتب اسم المستخدم للتأكيد.", "Type your username to confirm.");
  const u = a.username;
  const del = async (t: string, col = "username") => must(await db().from(t).delete().eq(col, u));
  for (const t of ["hl_weight_logs", "hl_habit_logs", "hl_diet_plans", "hl_weekly_reports", "hl_user_challenges", "hl_streaks", "hl_badges", "hl_favourites", "hl_recipe_likes", "hl_recipe_messages", "hl_group_challenge_members", "hl_push_subscriptions", "hl_ai_requests"]) {
    if (t === "hl_ai_requests") continue; // recipes reference requests: delete recipes first
    await del(t);
  }
  await del("hl_recipes");
  await del("hl_ai_requests");
  // referral rows are kept (usernames only) so the per-inviter cap and one-reward-per-invite rules survive deletion
  await del("hl_group_challenge_checks");
  must(await db().from("hl_profiles").update({
    age: null, sex: null, weight_kg: null, height_cm: null, goal: null, activity: null, conditions: [], disclaimer_accepted_at: null,
    leaderboard_visible: false, deleted_at: new Date().toISOString(), token_version: (a.profile.token_version ?? 0) + 1, updated_at: new Date().toISOString(),
  }).eq("username", u));
  return ok({ deleted: true });
});
