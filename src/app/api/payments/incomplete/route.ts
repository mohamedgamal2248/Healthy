import { ok, readJson, route, E } from "@/server/http";
import { requireVerified } from "@/server/auth";
import { handleIncomplete } from "@/server/purchases";
import { rateLimit } from "@/server/ratelimit";

export const POST = route(async (req) => {
  const a = await requireVerified(req);
  await rateLimit("pay", a.username, 60, 3600);
  const { paymentId } = await readJson<{ paymentId?: string }>(req);
  if (!paymentId || !/^[A-Za-z0-9_-]{8,80}$/.test(paymentId)) throw E.bad();
  return ok(await handleIncomplete(a, paymentId));
});
