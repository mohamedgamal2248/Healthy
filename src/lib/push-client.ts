"use client";
// Browser side of daily reminders (Web Push). The permission prompt must come from a tap, so nothing here runs silently.
import { api } from "./api";

const ASKED_KEY = "healthy.push.asked";
const ASK_AGAIN_DAYS = 14;

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const b64ToBytes = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function isSubscribed(): Promise<boolean> {
  try { return !!(await currentSubscription()) && Notification.permission === "granted"; } catch { return false; }
}

export type EnableResult = "ok" | "denied" | "not_configured";

/** Ask for permission, subscribe this device and register it with the server. Call from a tap. */
export async function enablePush(): Promise<EnableResult> {
  const k = await api<{ enabled: boolean; key: string | null }>("/push/key", { anon: true });
  if (!k.enabled || !k.key) return "not_configured";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  const reg = (await navigator.serviceWorker.getRegistration("/sw.js")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(k.key) }));
  await api("/push/subscribe", { body: sub.toJSON() });
  return "ok";
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) { await api("/push/subscribe", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {}); await sub.unsubscribe(); }
}

/** Short, readable reason for a failed subscription (shown in the app so problems are diagnosable). */
export function describePushError(e: unknown): string {
  const x = e as { name?: string; message?: string };
  return `${x?.name ?? "Error"}: ${(x?.message ?? "unknown").slice(0, 120)}`;
}

/**
 * If the browser permission is ALREADY granted (for example allowed from the browser's site settings) but this device was never
 * registered, register it now. Needs no tap because no permission prompt is involved. Returns an error text if it failed.
 */
export async function syncPushIfGranted(): Promise<{ registered: boolean; error?: string }> {
  try {
    if (!pushSupported() || Notification.permission !== "granted") return { registered: false };
    if (await isSubscribed()) return { registered: true };
    return { registered: (await enablePush()) === "ok" };
  } catch (e) {
    return { registered: false, error: describePushError(e) };
  }
}

/** Should we offer the reminder right after sign-in? Only if the browser can, nobody decided yet, and we have not asked lately. */
export function shouldAskPush(): boolean {
  if (!pushSupported() || Notification.permission !== "default") return false;
  try { const t = Number(localStorage.getItem(ASKED_KEY) || 0); return !t || Date.now() - t > ASK_AGAIN_DAYS * 86400_000; } catch { return true; }
}
export function markPushAsked() {
  try { localStorage.setItem(ASKED_KEY, String(Date.now())); } catch { /* ignore */ }
  window.dispatchEvent(new Event("healthy:push-asked"));
}
