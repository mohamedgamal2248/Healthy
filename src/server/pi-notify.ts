// Pi Notification Center (in-app notifications): POST /v2/in_app_notifications/notify with the Server API Key.
// Delivery is best-effort per user: Pi silently skips people who have not granted the in_app_notifications scope
// or turned notifications off. Limits from the docs: 256 notifications per request, 48 per user per 24 hours.
const PI_API = "https://api.minepi.com/v2";
export const NOTIFY_BATCH = 256;

export type PiNotification = { user_uid: string; title: string; body: string; subroute: string };

export type NotifyResult = { requested: number; delivered: number; error?: string };

/** Send one batch (<= 256). Never throws: a notification problem must not break the cron job. */
export async function sendPiNotifications(items: PiNotification[]): Promise<NotifyResult> {
  const key = process.env.PI_API_KEY;
  if (!key || !items.length) return { requested: items.length, delivered: 0, error: key ? undefined : "no_api_key" };
  if (items.length > NOTIFY_BATCH) throw new Error("batch too large");
  try {
    const res = await fetch(`${PI_API}/in_app_notifications/notify`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ notifications: items }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[pi-notify]", res.status, text.slice(0, 200));
      return { requested: items.length, delivered: 0, error: `http_${res.status}` };
    }
    const data = (await res.json().catch(() => null)) as { delivered_notifications?: unknown[] } | null;
    return { requested: items.length, delivered: data?.delivered_notifications?.length ?? 0 };
  } catch (e) {
    console.error("[pi-notify]", e instanceof Error ? e.message : e);
    return { requested: items.length, delivered: 0, error: "network" };
  }
}
