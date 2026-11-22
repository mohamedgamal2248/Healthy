import { ok, route } from "@/server/http";
import { rateLimit, clientIp } from "@/server/ratelimit";

/** Sink for browser crash reports so they appear in the Vercel runtime logs. */
export const POST = route(async (req) => {
  await rateLimit("client-error", clientIp(req), 20, 600);
  const b = (await req.json().catch(() => ({}))) as { message?: string; digest?: string; path?: string };
  console.error("[client-error]", JSON.stringify({ message: String(b.message ?? "").slice(0, 300), digest: String(b.digest ?? "").slice(0, 60), path: String(b.path ?? "").slice(0, 100) }));
  return ok({ ok: true });
});
