import { db } from "./supabase";
import { HttpError } from "./http";

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

/**
 * Fixed-window limiter backed by one atomic Postgres upsert (works across all serverless instances).
 * Fails OPEN on database errors so a limiter outage never takes the product down.
 */
export async function rateLimit(name: string, who: string, max: number, windowSec: number): Promise<void> {
  try {
    const res = await db().rpc("hl_rate_hit", { p_key: `${name}:${who}`, p_window: windowSec, p_max: max });
    if (res.error) {
      console.error("[ratelimit]", res.error.message);
      return;
    }
    if (res.data === false) {
      throw new HttpError(429, "rate_limited", "طلبات كثيرة في وقت قصير. انتظر قليلًا ثم حاول مرة أخرى.", "Too many requests. Please wait a moment and try again.");
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    console.error("[ratelimit]", e);
  }
}
