import { ok, readJson, route } from "@/server/http";
import { requireVerified } from "@/server/auth";
import { createPurchase } from "@/server/purchases";

export const POST = route(async (req) => {
  const a = await requireVerified(req);
  const { item } = await readJson<{ item?: string }>(req);
  return ok(await createPurchase(a, item));
});
