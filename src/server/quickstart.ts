import { db, must } from "./supabase";
import { QUICKSTART, type QuickstartStep } from "@/config/pricing";
import { rewardReferralIfAny } from "./referral";

type P = { age: number | null; sex: string | null; weight_kg: number | string | null; height_cm: number | string | null; goal: string | null; activity: string | null; disclaimer_accepted_at: string | null };

/** Step 1: the health profile is complete (everything the calorie target needs) and the health note was accepted. */
export function profileComplete(p: P): boolean {
  const n = (v: unknown) => v !== null && v !== undefined && Number.isFinite(Number(v)) && Number(v) > 0;
  return n(p.age) && !!p.sex && n(p.weight_kg) && n(p.height_cm) && !!p.goal && !!p.activity && !!p.disclaimer_accepted_at;
}

export type QsStep = { key: QuickstartStep; done: boolean; granted: boolean; credits: number };
export type QsState = { steps: QsStep[]; earned: number; allGranted: boolean; kyc: boolean; fresh: { key: QuickstartStep; credits: number }[]; referralReward: boolean };
const KEYS = Object.keys(QUICKSTART) as QuickstartStep[];

/**
 * Where the person stands in the quick start, and grants the credit for every finished step (once per account, in SQL).
 * Only verified (KYC) accounts receive credits, the same condition Healthy AI itself needs. A logged meal counts when it comes
 * from the catalogue, a photo scan or an AI recipe, or is a manual entry of at least 100 kcal, so a fake "1 kcal" entry earns nothing.
 * `fresh` lists credits the person has not been told about yet (it is shown once). Safe to call as often as you like.
 */
export async function quickstartState(username: string): Promise<QsState> {
  const [rows, prof] = await Promise.all([
    db().from("hl_quickstart").select("step,credits,seen").eq("username", username),
    db().from("hl_profiles").select("age,sex,weight_kg,height_cm,goal,activity,disclaimer_accepted_at,reminder_set_at,kyc_verified,deleted_at").eq("username", username).maybeSingle(),
  ]);
  const got = must(rows) as { step: QuickstartStep; credits: number; seen: boolean }[];
  const p = must(prof) as (P & { reminder_set_at: string | null; kyc_verified: boolean; deleted_at: string | null }) | null;
  const granted = new Map(got.map((r) => [r.step, r]));
  const base = (done: Record<QuickstartStep, boolean>, kyc: boolean): QsStep[] => KEYS.map((key) => ({ key, done: done[key] || granted.has(key), granted: granted.has(key), credits: QUICKSTART[key] }));
  if (!p || p.deleted_at) return { steps: base({ profile: false, meal: false, reminder: false }, false), earned: 0, allGranted: false, kyc: false, fresh: [], referralReward: false };

  const done: Record<QuickstartStep, boolean> = { profile: profileComplete(p), meal: granted.has("meal"), reminder: !!p.reminder_set_at };
  if (!done.meal) {
    const m = must(await db().from("hl_food_log").select("id").eq("username", username).or("source.in.(meal,scan,recipe),calories.gte.100").limit(1)) as unknown[];
    done.meal = m.length > 0;
  }
  const newly: QuickstartStep[] = [];
  if (p.kyc_verified) {
    for (const key of KEYS) {
      if (!done[key] || granted.has(key)) continue;
      const ok = must(await db().rpc("hl_quickstart_claim", { p_user: username, p_step: key, p_credits: QUICKSTART[key] })) as boolean;
      granted.set(key, { step: key, credits: QUICKSTART[key], seen: false });
      if (ok) newly.push(key);
    }
  }
  // A friend who invited this person is rewarded as soon as the profile is complete and a real meal is logged (the 3-day streak path still works too).
  let referralReward = false;
  if (newly.length && done.profile && done.meal && p.kyc_verified) referralReward = await rewardReferralIfAny(username).catch(() => false);

  const fresh = [...granted.values()].filter((g) => !g.seen).map((g) => ({ key: g.step, credits: g.credits }));
  if (fresh.length) await db().from("hl_quickstart").update({ seen: true }).eq("username", username).in("step", fresh.map((f) => f.key));
  const steps = base(done, p.kyc_verified);
  return { steps, earned: steps.filter((s) => s.granted).reduce((n, s) => n + s.credits, 0), allGranted: steps.every((s) => s.granted), kyc: p.kyc_verified, fresh, referralReward };
}
