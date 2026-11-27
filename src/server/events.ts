import { db, must } from "./supabase";
import { sendPiNotifications } from "./pi-notify";
import { dropSubscription, pushConfigured, sendPush, type Sub } from "./push";

type Text = { title: string; body: string };

/**
 * One-off celebration notices (streak milestone, weekly challenge finished). Each (person, key) is sent at most once ever:
 * the log row is the claim, so retries and double taps cannot repeat it. Respects "notify_events" and, for the Pi channel, "notify_pi".
 * Never throws: a notice must not break the action that triggered it.
 */
export async function notifyEvent(username: string, key: string, text: (lang: "ar" | "en") => Text, subroute = "/today"): Promise<void> {
  try {
    const p = must(await db().from("hl_profiles").select("pi_uid,language,notify_pi,notify_events,deleted_at").eq("username", username).maybeSingle()) as { pi_uid: string | null; language: string | null; notify_pi: boolean; notify_events: boolean; deleted_at: string | null } | null;
    if (!p || p.deleted_at || !p.notify_events) return;
    const claim = await db().from("hl_notif_log").insert({ username, kind: `once:${key}` });
    if (claim.error) return; // already sent (unique violation) or a transient error: do not risk repeating
    const t = text(p.language === "ar" ? "ar" : "en");
    if (p.notify_pi && p.pi_uid) await sendPiNotifications([{ user_uid: p.pi_uid, title: t.title, body: t.body, subroute }]);
    if (pushConfigured()) {
      const subs = must(await db().from("hl_push_subscriptions").select("endpoint,p256dh,auth").eq("username", username)) as Sub[];
      for (const s of subs) if ((await sendPush(s, t)) === "gone") await dropSubscription(s.endpoint);
    }
  } catch (e) {
    console.error("[events]", e instanceof Error ? e.message : e);
  }
}
