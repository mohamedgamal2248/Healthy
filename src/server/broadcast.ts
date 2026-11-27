import { db, must } from "./supabase";
import { NOTIFY_BATCH, sendPiNotifications, type PiNotification } from "./pi-notify";
import { dropSubscription, pushConfigured, sendPush, type Sub } from "./push";

export type BroadcastRow = {
  id: string; audience: string; subroute: string; mode: "now" | "at" | "local"; status: string;
  send_at: string | null; local_date: string | null; local_hour: number | null;
  title_ar: string | null; body_ar: string | null; title_en: string | null; body_en: string | null;
};
type Claimed = { username: string; pi_uid: string | null; language: string | null; notify_pi: boolean };

/** Text for one person: their own language when written, otherwise the other one. */
export function textFor(b: Pick<BroadcastRow, "title_ar" | "body_ar" | "title_en" | "body_en">, lang: string | null): { title: string; body: string } | null {
  const ar = b.title_ar && b.body_ar ? { title: b.title_ar, body: b.body_ar } : null;
  const en = b.title_en && b.body_en ? { title: b.title_en, body: b.body_en } : null;
  return lang === "ar" ? ar ?? en : en ?? ar;
}

const ROUND = 500;
const MAX_ROUNDS = 10;
/** Local-mode announcements stay open until every time zone (UTC-12 to UTC+14) has passed the chosen hour. */
const LOCAL_WINDOW_HOURS = 28;

/**
 * Send what is due for one announcement. People are claimed in SQL (once each, only when their own clock allows),
 * so overlapping runs never double-send. Safe to call repeatedly.
 */
export async function runBroadcast(id: string): Promise<{ recipients: number; pi_delivered: number; push_sent: number }> {
  const b = must(await db().from("hl_broadcasts").select("id,audience,subroute,mode,status,send_at,local_date,local_hour,title_ar,body_ar,title_en,body_en").eq("id", id).maybeSingle()) as BroadcastRow | null;
  const out = { recipients: 0, pi_delivered: 0, push_sent: 0 };
  if (!b || (b.status !== "sending" && b.status !== "scheduled")) return out;
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const rows = must(await db().rpc("hl_claim_broadcast", { p_id: b.id, p_limit: ROUND })) as Claimed[];
      if (!rows.length) break;
      const withText = rows.filter((r) => textFor(b, r.language));
      const pi: PiNotification[] = withText.filter((r) => r.notify_pi && r.pi_uid).map((r) => ({ user_uid: r.pi_uid!, ...textFor(b, r.language)!, subroute: b.subroute }));
      let piReq = 0, piDel = 0, devices = 0, sent = 0;
      for (let k = 0; k < pi.length; k += NOTIFY_BATCH) {
        const r = await sendPiNotifications(pi.slice(k, k + NOTIFY_BATCH));
        piReq += r.requested; piDel += r.delivered;
      }
      if (pushConfigured()) {
        const byUser = new Map(withText.map((r) => [r.username, r]));
        const names = [...byUser.keys()];
        for (let k = 0; k < names.length; k += 200) {
          const subs = must(await db().from("hl_push_subscriptions").select("endpoint,p256dh,auth,username").in("username", names.slice(k, k + 200))) as (Sub & { username: string })[];
          devices += subs.length;
          for (let j = 0; j < subs.length; j += 10) {
            await Promise.all(subs.slice(j, j + 10).map(async (s) => {
              const t = textFor(b, byUser.get(s.username)?.language ?? null);
              if (!t) return;
              const r = await sendPush(s, t);
              if (r === "ok") sent++;
              else if (r === "gone") await dropSubscription(s.endpoint);
            }));
          }
        }
      }
      must(await db().rpc("hl_broadcast_add", { p_id: b.id, p_rec: rows.length, p_pi_req: piReq, p_pi_del: piDel, p_dev: devices, p_sent: sent }));
      out.recipients += rows.length; out.pi_delivered += piDel; out.push_sent += sent;
      if (rows.length < ROUND) break;
    }
    // "now" and "at" announcements are finished once everybody has been claimed; "local" ones when the last time zone has passed the hour.
    const finished = b.mode !== "local" || (b.local_date && b.local_hour !== null && Date.now() > Date.parse(`${b.local_date}T00:00:00Z`) + (b.local_hour + LOCAL_WINDOW_HOURS) * 3600_000);
    if (finished) await db().from("hl_broadcasts").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", b.id);
    else if (b.status === "sending") await db().from("hl_broadcasts").update({ status: "scheduled" }).eq("id", b.id);
  } catch (e) {
    await db().from("hl_broadcasts").update({ status: "failed", finished_at: new Date().toISOString() }).eq("id", b.id);
    throw e;
  }
  return out;
}

/** Called every hour: runs the scheduled announcements whose time has come. */
export async function processDueBroadcasts(): Promise<number> {
  const now = Date.now();
  const rows = must(await db().from("hl_broadcasts").select("id,mode,send_at,local_date,local_hour").eq("status", "scheduled").limit(20)) as { id: string; mode: string; send_at: string | null; local_date: string | null; local_hour: number | null }[];
  let ran = 0;
  for (const r of rows) {
    const due = r.mode === "at"
      ? !!r.send_at && Date.parse(r.send_at) <= now
      : r.mode === "local" && !!r.local_date && r.local_hour !== null && Date.parse(`${r.local_date}T00:00:00Z`) + (r.local_hour - 14) * 3600_000 <= now; // earliest zone (UTC+14) reaches the hour
    if (!due) continue;
    try { await runBroadcast(r.id); ran++; } catch (e) { console.error("[broadcast]", r.id, e instanceof Error ? e.message : e); }
  }
  return ran;
}
