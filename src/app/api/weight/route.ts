import { z } from "zod";
import { ok, readJson, route, E } from "@/server/http";
import { requireUser } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";
import { logWeight } from "@/server/weight";
import { hasActivePlan } from "@/server/credits";
import { createPlan } from "@/server/plan";

const Body = z.object({ weight_kg: z.number().min(20).max(400) });

/** At most one official weekly entry feeds the diet plan; extra entries are kept as notes. */
export const POST = route(async (req) => {
  const a = await requireUser(req);
  await rateLimit("weight", a.username, 40, 3600);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw E.bad("اكتب وزنًا صحيحًا بالكيلوجرام.", "Enter a valid weight in kg.");
  const { official: isOfficial } = await logWeight(a, parsed.data.weight_kg);
  let planRefreshed = false;
  if (isOfficial) {
    // A new official weight refreshes the plan for the next week (subscribers; free).
    if (a.profile.kyc_verified && a.profile.disclaimer_accepted_at && (await hasActivePlan(a.username))) {
      try {
        await createPlan({ ...a, profile: { ...a.profile, weight_kg: parsed.data.weight_kg } }, "auto");
        planRefreshed = true;
      } catch (e) {
        console.error("[weight] plan refresh skipped", e);
      }
    }
  }
  return ok({ official: isOfficial, planRefreshed });
});
