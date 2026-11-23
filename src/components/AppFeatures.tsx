"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { Spinner } from "./ui";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const b64ToBytes = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** "Install the app" + daily reminders. Works in an ordinary browser (Chrome, Safari home-screen app); Pi Browser may not support push. */
export function AppFeatures() {
  const { tr, toast, errMsg } = useApp();
  const [install, setInstall] = useState<BIPEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setStandalone(window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => { e.preventDefault(); setInstall(e as BIPEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (ok) {
      setDenied(Notification.permission === "denied");
      navigator.serviceWorker.getRegistration("/sw.js").then((r) => r?.pushManager.getSubscription()).then((s) => setOn(!!s && Notification.permission === "granted")).catch(() => {});
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const k = await api<{ enabled: boolean; key: string | null }>("/push/key", { anon: true });
      if (!k.enabled || !k.key) { toast(tr("التنبيهات غير مفعّلة حاليًا.", "Reminders are not enabled yet."), "err"); return; }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setDenied(perm === "denied"); return; }
      const reg = (await navigator.serviceWorker.getRegistration("/sw.js")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(k.key) }));
      await api("/push/subscribe", { body: sub.toJSON() });
      setOn(true);
      toast(tr("تم تفعيل التذكير اليومي", "Daily reminder is on"), "ok");
    } catch (e) {
      toast(errMsg(e), "err");
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await api("/push/subscribe", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {}); await sub.unsubscribe(); }
      setOn(false);
    } finally { setBusy(false); }
  };

  const doInstall = async () => { if (!install) return; await install.prompt(); await install.userChoice.catch(() => null); setInstall(null); };

  return (
    <section className="card space-y-4">
      <h2 className="h2">{tr("التطبيق والتذكيرات", "App and reminders")}</h2>
      {!standalone && (
        install ? (
          <button className="btn-primary w-full" onClick={doInstall}><Icon name="plus" />{tr("ثبّت التطبيق على هاتفك", "Install the app on your phone")}</button>
        ) : (
          <p className="muted">{ios ? tr("على iPhone: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية» لتثبيت التطبيق وتفعيل التذكيرات.", "On iPhone: tap Share, then Add to Home Screen to install the app and enable reminders.") : tr("افتح الموقع من متصفح عادي (مثل Chrome) لتثبيته كتطبيق.", "Open the site in a regular browser (such as Chrome) to install it as an app.")}</p>
        )
      )}
      {supported ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0"><p className="font-extrabold">{tr("تذكير يومي", "Daily reminder")}</p><p className="muted">{denied ? tr("التنبيهات محظورة من إعدادات المتصفح.", "Notifications are blocked in your browser settings.") : tr("تنبيه واحد في اليوم إذا لم تُكمل تحدي اليوم.", "One notification a day if you haven't done today's challenge.")}</p></div>
          <button className={on ? "btn-ghost btn-sm" : "btn-primary btn-sm"} disabled={busy || denied} onClick={on ? disable : enable} aria-pressed={on}>{busy ? <Spinner size={16} /> : null}{on ? tr("إيقاف", "Turn off") : tr("تفعيل", "Turn on")}</button>
        </div>
      ) : (
        <p className="muted">{tr("هذا المتصفح لا يدعم التنبيهات. جرّب Chrome، أو ثبّت التطبيق على الشاشة الرئيسية.", "This browser doesn't support notifications. Try Chrome, or install the app to your home screen.")}</p>
      )}
    </section>
  );
}
