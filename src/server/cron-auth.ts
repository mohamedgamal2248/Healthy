import { timingSafeEqual } from "node:crypto";
import { E } from "./http";

const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

/**
 * Scheduled jobs are called with `Authorization: Bearer <secret>`. Two callers are accepted:
 * Vercel Cron (CRON_SECRET) and the hourly database scheduler (SCHEDULER_SECRET). Anything else gets a plain 404.
 */
export function requireCron(req: Request) {
  const got = req.headers.get("authorization") ?? "";
  const ok = [process.env.CRON_SECRET, process.env.SCHEDULER_SECRET].some((s) => !!s && same(got, `Bearer ${s}`));
  if (!ok) throw E.notFound();
}
