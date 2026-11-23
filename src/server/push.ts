import * as webpush from "web-push";
import { db, must } from "./supabase";

let ready: boolean | null = null;
/** Web Push needs VAPID keys (server env). Without them the feature is simply off. */
export function pushConfigured(): boolean {
  if (ready !== null) return ready;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (ready = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://healthy-ai-app.vercel.app", pub, priv);
  return (ready = true);
}
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? null;

export type Sub = { endpoint: string; p256dh: string; auth: string };

/** Send one notification. Returns "gone" when the browser says the subscription no longer exists. */
export async function sendPush(sub: Sub, payload: { title: string; body: string }, opts: { urgency?: "normal" | "high"; detail?: { status?: number | string } } = {}): Promise<"ok" | "gone" | "error"> {
  try {
    const r = await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 6 * 3600, urgency: opts.urgency ?? "normal" });
    if (opts.detail) opts.detail.status = r.statusCode;
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (opts.detail) opts.detail.status = status ?? (e instanceof Error ? e.message.slice(0, 80) : "error");
    if (status === 404 || status === 410) return "gone";
    console.error("[push]", status ?? (e instanceof Error ? e.message : e));
    return "error";
  }
}

export async function dropSubscription(endpoint: string) {
  must(await db().from("hl_push_subscriptions").delete().eq("endpoint", endpoint));
}
