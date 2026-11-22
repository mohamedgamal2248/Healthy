import { ok, readJson, route, E } from "@/server/http";
import { requireUser } from "@/server/auth";
import { cancel } from "@/server/purchases";

export const POST = route(async (req) => {
  const a = await requireUser(req);
  const { purchaseId, reason } = await readJson<{ purchaseId?: string; reason?: string }>(req);
  if (!purchaseId) throw E.bad();
  await cancel(a, purchaseId, reason === "error" ? "error" : "cancelled");
  return ok({ ok: true });
});
