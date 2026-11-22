import { ok, readJson, route, E } from "@/server/http";
import { requireUser } from "@/server/auth";
import { swapChallenge } from "@/server/challenges";

export const POST = route(async (req) => {
  const a = await requireUser(req);
  const { id } = await readJson<{ id?: string }>(req);
  if (!id) throw E.bad();
  await swapChallenge(a, id);
  return ok({ ok: true });
});
