import { z } from "zod";
import { db, must } from "@/server/supabase";
import { ok, readJson, route, E } from "@/server/http";
import { adminUsernames, requireUser } from "@/server/auth";
import { getBalances } from "@/server/credits";

export const GET = route(async (req) => {
  const a = await requireUser(req);
  const balances = a.profile.kyc_verified ? await getBalances(a.username) : null;
  const { pi_uid: _uid, ...profile } = a.profile;
  void _uid;
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
  accept_disclaimer: z.boolean().optional(),
});

export const PATCH = route(async (req) => {
  const a = await requireUser(req);
  const parsed = Patch.safeParse(await readJson(req));
  if (!parsed.success) throw E.bad("بيانات الملف الصحي غير صالحة.", "Invalid profile data.");
  const { accept_disclaimer, ...fields } = parsed.data;
  const update: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
  const merged = { ...a.profile, ...fields };
  if (accept_disclaimer) {
    if (!merged.age || !merged.goal) throw E.bad("العمر والهدف مطلوبان قبل الموافقة.", "Age and goal are required before accepting.");
    update.disclaimer_accepted_at = a.profile.disclaimer_accepted_at ?? new Date().toISOString();
  }
  must(await db().from("profiles").update(update).eq("username", a.username));
  return ok({ ok: true });
});
