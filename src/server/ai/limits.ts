import { db } from "../supabase";
import { HttpError } from "../http";
import { AI_LIMITS } from "@/config/pricing";

/**
 * Guards checked BEFORE a credit is spent or the model is called:
 *  - one generation at a time per user (also stops a double charge from a double tap)
 *  - no quota on paid requests: the credit balance is the limit
 *  - a cap on FAILED / refunded attempts per hour: those cost model money but earn nothing, so they are the abuse path
 *  - a very high global daily emergency brake
 */
export async function enforceGenerationLimits(username: string): Promise<void> {
  const now = Date.now();
  const hourAgo = new Date(now - 3600_000).toISOString();
  const startOfUtcDay = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").toISOString();
  const [inflight, failed, global] = await Promise.all([
    db().from("hl_ai_requests").select("id", { count: "exact", head: true }).eq("username", username).eq("status", "pending").gte("created_at", new Date(now - AI_LIMITS.inFlightWindowMs).toISOString()),
    db().from("hl_ai_requests").select("id", { count: "exact", head: true }).eq("username", username).eq("type", "recipe").in("status", ["refunded", "failed"]).or("error.is.null,error.not.in.(duplicate,no_credits,concurrent)").gte("created_at", hourAgo),
    db().from("hl_ai_requests").select("id", { count: "exact", head: true }).eq("type", "recipe").or("error.is.null,error.neq.no_credits").gte("created_at", startOfUtcDay),
  ]);
  if ((inflight.count ?? 0) > 0) throw new HttpError(429, "in_flight", "عندك طلب قيد التنفيذ بالفعل. انتظر حتى ينتهي.", "You already have a request running. Please wait for it to finish.");
  if ((failed.count ?? 0) >= AI_LIMITS.failedPerHour) throw new HttpError(429, "too_many_failed", "تكررت محاولات لم تكتمل في الساعة الأخيرة. جرّب بعد قليل بصياغة مختلفة، ولم يُخصم أي كريدت.", "Several attempts did not complete in the last hour. Try again shortly with different wording; no credit was used.");
  if ((global.count ?? 0) >= AI_LIMITS.globalPerDay) throw new HttpError(503, "busy", "الخدمة مزدحمة الآن. حاول لاحقًا، ولم يُخصم أي كريدت.", "The service is busy right now. Please try later; no credit was used.");
}

/** Fail (and let the caller refund) if the work takes longer than the time budget. */
export async function withDeadline<T>(p: Promise<T>, ms: number = AI_LIMITS.timeoutMs): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error("timeout")), ms); });
  try { return await Promise.race([p, timeout]); } finally { clearTimeout(t!); }
}
