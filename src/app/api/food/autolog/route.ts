import { ok, route } from "@/server/http";
import { requireUser } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";
import { autologToday } from "@/server/autolog";

/** Puts today's planned meals into the diary (once per day). Safe to call repeatedly: later calls add nothing. */
export const POST = route(async (req) => {
  const a = await requireUser(req);
  await rateLimit("autolog", a.username, 30, 3600);
  return ok(await autologToday(a));
});
