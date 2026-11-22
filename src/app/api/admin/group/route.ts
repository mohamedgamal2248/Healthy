import { db, must } from "@/server/supabase";
import { ok, readJson, route, E } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { weekStart } from "@/lib/dates";

/** Create / replace the weekly group challenge. Ranking and badges only: no fee, no Pi prize. */
export const POST = route(async (req) => {
  const a = await requireAdmin(req);
  const { week_start, challenge_id, title_ar, title_en } = await readJson<{ week_start?: string; challenge_id?: string | null; title_ar?: string; title_en?: string }>(req);
  if (!title_ar || !title_en) throw E.bad();
  const week = weekStart(week_start && /^\d{4}-\d{2}-\d{2}$/.test(week_start) ? week_start : a.today);
  must(await db().from("hl_group_challenges").upsert({ week_start: week, challenge_id: challenge_id || null, title_ar, title_en }, { onConflict: "week_start" }));
  return ok({ week_start: week });
});
