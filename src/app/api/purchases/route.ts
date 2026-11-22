import { ok, readJson, route } from "@/server/http";
import { requireVerified } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";
import { createPurchase } from "@/server/purchases";

export const POST = route(async (req) => {
  const a = await requireVerified(req);
  await rateLimit("purchase", a.username, 12, 3600);
  const { item } = await readJson<{ item?: string }>(req);
  return ok(await createPurchase(a, item));
});
