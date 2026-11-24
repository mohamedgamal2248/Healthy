import { ok, route } from "@/server/http";
import { requireUser } from "@/server/auth";
import { trackResult } from "@/server/chef";
import { rateLimit } from "@/server/ratelimit";

/** Turn an AI workout (today) or 7-day challenge into tracked challenges on the Today page. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const a = await requireUser(req);
  await rateLimit("track", a.username, 30, 3600);
  const { id } = await params;
  return ok(await trackResult(a, id));
});
