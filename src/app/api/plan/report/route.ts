import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireVerified } from "@/server/auth";
import { saveReport } from "@/server/plan";
import { hasActivePlan } from "@/server/credits";
import { weekStart } from "@/lib/dates";

export const GET = route(async (req) => {
  const a = await requireVerified(req);
  if (!(await hasActivePlan(a.username))) return ok({ subscribed: false, reports: [] });
  const reports = must(await db().from("hl_weekly_reports").select("week_start,summary,tip,created_at").eq("username", a.username).order("week_start", { ascending: false }).limit(8));
  return ok({ subscribed: true, reports });
});

/** Generate (or refresh) this week's report. Part of the subscription, no credit cost. */
export const POST = route(async (req) => {
  const a = await requireVerified(req);
  return ok({ report: await saveReport(a, weekStart(a.today)) });
});
