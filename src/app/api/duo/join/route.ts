import { ok, readJson, route, E } from "@/server/http";
import { requireVerified } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";
import { joinDuo } from "@/server/duo";

/** Accept a friend's invite. Codes are single-use, expire after 7 days and cannot be your own. */
export const POST = route(async (req) => {
  const a = await requireVerified(req);
  await rateLimit("duo-join", a.username, 20, 3600); // slows down code guessing
  const { code } = await readJson<{ code?: string }>(req);
  if (typeof code !== "string") throw E.bad();
  return ok(await joinDuo(a, code));
});
