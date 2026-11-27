import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { forget, memo } from "@/server/memo";
import { flushTelemetry } from "@/server/telemetry";

/**
 * Owner-only site monitor: request counts, errors and slow requests per route (last 24 h), recent error messages, AI outcomes,
 * Pi revenue per day and database health. Reads small pre-aggregated tables, cached 20 s per instance.
 */
export const GET = route(async (req) => {
  await requireAdmin(req);
  const fresh = new URL(req.url).searchParams.has("fresh");
  if (fresh) { forget("admin-monitor"); await flushTelemetry(true); } // include this instance's latest counters
  return ok(await memo("admin-monitor", 20_000, async () => must(await db().rpc("hl_admin_monitor"))));
});
