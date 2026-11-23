import { ok, readJson, route, E } from "@/server/http";
import { requireUser } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";
import { cancel } from "@/server/purchases";

/** Browser-reported cancel/error. The server decides what it means (see cancel()); it never voids a real payment. */
export const POST = route(async (req) => {
  const a = await requireUser(req);
  await rateLimit("pay-cancel", a.username, 30, 3600);
  const { purchaseId, reason } = await readJson<{ purchaseId?: string; reason?: string }>(req);
  if (!purchaseId || typeof purchaseId !== "string") throw E.bad();
  return ok({ result: await cancel(a, purchaseId, reason === "error" ? "error" : "cancelled") });
});
