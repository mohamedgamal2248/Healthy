import { z } from "zod";
import { db, must } from "@/server/supabase";
import { ok, readJson, route, E } from "@/server/http";
import { requireUser } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";

const Body = z.object({
  water_cups: z.number().int().min(0).max(40).optional(),
  sleep_hours: z.number().min(0).max(24).optional(),
  steps: z.number().int().min(0).max(200000).optional(),
});

/** Manual habit check-in for today (local day). No sensors or wearables in the MVP. */
export const POST = route(async (req) => {
  const a = await requireUser(req);
  await rateLimit("habits", a.username, 240, 3600);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw E.bad("قيمة غير صالحة.", "Invalid value.");
  must(await db().from("hl_habit_logs").upsert({ username: a.username, date: a.today, ...parsed.data }, { onConflict: "username,date" }));
  return ok({ ok: true });
});
