import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { forget, memo } from "@/server/memo";

/**
 * Owner-only usage report: who signed up and signed in, when, how often they open the app, Pi paid, plus daily active users
 * and return rates. Pi usernames, dates and counters only. No health data, and nothing a user typed is included.
 * Cached 30 s per instance so repeated refreshes never re-run the aggregate queries.
 */
export const GET = route(async (req) => {
  const a = await requireAdmin(req);
  const key = `admin-report:${a.today}`;
  if (new URL(req.url).searchParams.has("fresh")) forget(key);
  return ok(await memo(key, 30_000, async () => must(await db().rpc("hl_admin_report", { p_today: a.today }))));
});
