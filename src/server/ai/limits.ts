import { db } from "../supabase";
import { HttpError } from "../http";
import { AI_LIMITS } from "@/config/pricing";

/**
 * Cost / abuse guards, checked BEFORE a credit is spent or the model is called:
 *  - one generation at a time per user
 *  - per-hour and per-day caps per user (every attempt counts, including refused / refunded ones)
 *  - a global daily circuit breaker across all users
 */
export async function enforceGenerationLimits(username: string): Promise<void> {
  const now = Date.now();
  const hourAgo = new Date(now - 3600_000).toISOString();
  const dayAgo = new Date(now - 86400_000).toISOString();
  const startOfUtcDay = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").toISOString();
  const base = () => db().from("hl_ai_requests").select("id", { count: "exact", head: true }).eq("type", "recipe").neq("error", "no_credits");

  const [inflight, hour, day, global] = await Promise.all([
    db().from("hl_ai_requests").select("id", { count: "exact", head: true }).eq("username", username).eq("status", "pending").gte("created_at", new Date(now - AI_LIMITS.inFlightWindowMs).toISOString()),
    base().eq("username", username).gte("created_at", hourAgo),
    base().eq("username", username).gte("created_at", dayAgo),
    base().gte("created_at", startOfUtcDay),
  ]);
  if ((inflight.count ?? 0) > 0) throw new HttpError(429, "in_flight", "عندك طلب قيد التنفيذ بالفعل. انتظر حتى ينتهي.", "You already have a request running. Please wait for it to finish.");
  if ((hour.count ?? 0) >= AI_LIMITS.perHour) throw new HttpError(429, "rate_limited_hour", `وصلت للحد الأقصى (${AI_LIMITS.perHour} طلبات في الساعة). جرّب بعد قليل، ولم يُخصم أي كريدت.`, `Hourly limit reached (${AI_LIMITS.perHour} requests per hour). Try again shortly; no credit was used.`);
  if ((day.count ?? 0) >= AI_LIMITS.perDay) throw new HttpError(429, "rate_limited_day", `وصلت للحد اليومي (${AI_LIMITS.perDay} طلبًا). جرّب غدًا، ولم يُخصم أي كريدت.`, `Daily limit reached (${AI_LIMITS.perDay} requests). Try again tomorrow; no credit was used.`);
  if ((global.count ?? 0) >= AI_LIMITS.globalPerDay) throw new HttpError(503, "busy", "الخدمة مزدحمة الآن. حاول لاحقًا، ولم يُخصم أي كريدت.", "The service is busy right now. Please try later; no credit was used.");
}

/** Fail (and let the caller refund) if the work takes longer than the time budget. */
export async function withDeadline<T>(p: Promise<T>, ms = AI_LIMITS.timeoutMs): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error("timeout")), ms); });
  try { return await Promise.race([p, timeout]); } finally { clearTimeout(t!); }
}
