import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireAdmin } from "@/server/auth";

/**
 * Owner-only usage report: who signed up and signed in, when, how often they open the app, plus daily active users and
 * return rates. Pi usernames, dates and counters only. No health data, and nothing a user typed is included.
 */
export const GET = route(async (req) => {
  const a = await requireAdmin(req);
  const report = must(await db().rpc("hl_admin_report", { p_today: a.today }));
  return ok(report);
});
