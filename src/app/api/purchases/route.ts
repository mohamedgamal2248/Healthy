import { ok, readJson, route } from "@/server/http";
import { requireVerified } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";
import { createPurchase } from "@/server/purchases";
import { paymentsAllowed } from "@/config/network";
import { HttpError } from "@/server/http";

export const POST = route(async (req) => {
  if (!paymentsAllowed()) throw new HttpError(503, "payments_disabled", "الدفع متاح على شبكة Pi الرئيسية فقط.", "Payments are available on Pi Mainnet only.");
  const a = await requireVerified(req);
  await rateLimit("purchase", a.username, 12, 3600);
  const { item } = await readJson<{ item?: string }>(req);
  return ok(await createPurchase(a, item));
});
