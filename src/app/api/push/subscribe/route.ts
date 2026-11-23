import { db, must } from "@/server/supabase";
import { ok, readJson, route, E } from "@/server/http";
import { requireUser } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";
import { pushConfigured } from "@/server/push";

const b64url = /^[A-Za-z0-9_-]{16,200}$/;

/** Save this device's push subscription (reminders). Only the signed-in user can attach a device to their account. */
export const POST = route(async (req) => {
  const a = await requireUser(req);
  await rateLimit("push", a.username, 20, 3600);
  if (!pushConfigured()) throw E.notConfigured("التنبيهات");
  const b = await readJson<{ endpoint?: string; keys?: { p256dh?: string; auth?: string } }>(req);
  const endpoint = b.endpoint ?? "", p256dh = b.keys?.p256dh ?? "", auth = b.keys?.auth ?? "";
  // Push services are always https endpoints; refuse anything else so the server never POSTs to arbitrary hosts.
  if (!/^https:\/\/[^\s]{10,500}$/.test(endpoint) || !b64url.test(p256dh) || !b64url.test(auth)) throw E.bad();
  must(await db().from("hl_push_subscriptions").upsert({ endpoint, username: a.username, p256dh, auth, failures: 0 }, { onConflict: "endpoint" }));
  return ok({ subscribed: true });
});

export const DELETE = route(async (req) => {
  const a = await requireUser(req);
  const { endpoint } = await readJson<{ endpoint?: string }>(req);
  if (!endpoint) throw E.bad();
  must(await db().from("hl_push_subscriptions").delete().eq("endpoint", endpoint).eq("username", a.username));
  return ok({ subscribed: false });
});
