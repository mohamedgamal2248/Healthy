import { ok, readJson, route, E } from "@/server/http";
import { requireVerified } from "@/server/auth";
import { complete } from "@/server/purchases";

export const POST = route(async (req) => {
  const a = await requireVerified(req);
  const { paymentId, txid } = await readJson<{ paymentId?: string; txid?: string }>(req);
  if (!paymentId || !txid) throw E.bad();
  return ok(await complete(a, paymentId, txid));
});
