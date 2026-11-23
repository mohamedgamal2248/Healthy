import { ok, route } from "@/server/http";
import { requireVerified } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";
import { createDuo, listDuos } from "@/server/duo";

export const GET = route(async (req) => ok({ duos: await listDuos(await requireVerified(req)) }));

/** Start a 7-day challenge with a friend: returns an invite code to share. */
export const POST = route(async (req) => {
  const a = await requireVerified(req);
  await rateLimit("duo-create", a.username, 10, 3600);
  return ok(await createDuo(a));
});
