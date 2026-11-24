import { ok, readJson, route } from "@/server/http";
import { requireDisclaimer, requireVerified } from "@/server/auth";
import { refineResult } from "@/server/chef";
import { rateLimit } from "@/server/ratelimit";

export const maxDuration = 90;

/** One-tap change of a saved recipe / workout. Free (no credit), capped per result and per day; the original is kept. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const a = await requireVerified(req);
  requireDisclaimer(a);
  await rateLimit("refine", a.username, 40, 3600);
  const { id } = await params;
  const { action, note, lang } = await readJson<{ action?: string; note?: string; lang?: string }>(req);
  return ok({ recipe: await refineResult(a, id, action, note, lang) });
});
