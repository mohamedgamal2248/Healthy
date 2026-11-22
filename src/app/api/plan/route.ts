import { ok, readJson, route } from "@/server/http";
import { requireDisclaimer, requireUser, requireVerified } from "@/server/auth";
import { createPlan, planForWeek, planSafety } from "@/server/plan";
import { hasActivePlan, getBalances } from "@/server/credits";
import { addDays, weekStart } from "@/lib/dates";
import { PLAN_REGENERATE_COST } from "@/config/pricing";

export const maxDuration = 120;

/** Read-only: free users get `subscribed: false` (they see the offer, never a generated plan). */
export const GET = route(async (req) => {
  const a = await requireUser(req);
  const subscribed = await hasActivePlan(a.username);
  if (!subscribed) return ok({ subscribed: false });
  const week = weekStart(a.today);
  const [current, next, balances] = await Promise.all([planForWeek(a.username, week), planForWeek(a.username, addDays(week, 7)), getBalances(a.username)]);
  return ok({ subscribed: true, week, current, next, balances, regenerateCost: PLAN_REGENERATE_COST, safety: planSafety(a.profile.conditions), disclaimerAccepted: !!a.profile.disclaimer_accepted_at });
});

export const POST = route(async (req) => {
  const a = await requireVerified(req);
  requireDisclaimer(a);
  const body = await readJson<{ mode?: string }>(req).catch(() => ({ mode: "auto" }));
  const plan = await createPlan(a, body.mode === "regenerate" ? "regenerate" : "auto");
  return ok({ plan, safety: planSafety(a.profile.conditions) });
});
