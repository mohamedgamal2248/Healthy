import { ok, readJson, route, E } from "@/server/http";
import { requireVerified } from "@/server/auth";
import { approve } from "@/server/purchases";

export const POST = route(async (req) => {
  const a = await requireVerified(req);
  const { paymentId } = await readJson<{ paymentId?: string }>(req);
  if (!paymentId) throw E.bad();
  return ok(await approve(a, paymentId));
});
