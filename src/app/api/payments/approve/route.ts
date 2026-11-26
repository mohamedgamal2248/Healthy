import { ok, readJson, route, E } from "@/server/http";
import { requireVerified } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";
import { approve } from "@/server/purchases";
import { paymentsAllowed } from "@/config/network";
import { HttpError } from "@/server/http";

export const POST = route(async (req) => {
  if (!paymentsAllowed()) throw new HttpError(503, "payments_disabled", "الدفع متاح على شبكة Pi الرئيسية فقط.", "Payments are available on Pi Mainnet only.");
  const a = await requireVerified(req);
  await rateLimit("pay", a.username, 60, 3600);
  const { paymentId } = await readJson<{ paymentId?: string }>(req);
  if (!paymentId || !/^[A-Za-z0-9_-]{8,80}$/.test(paymentId)) throw E.bad();
  return ok(await approve(a, paymentId));
});
