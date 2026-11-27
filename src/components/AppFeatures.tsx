"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "./AppProvider";
import { promptInstall, useInstall } from "@/lib/pwa-install";
import { describePushError, disablePush, enablePush, pushSupported, syncPushIfGranted } from "@/lib/push-client";
import { Icon } from "./Icon";
import { Spinner } from "./ui";

/** "Install the app" + daily reminders. Works in an ordinary browser (Chrome, Safari home-screen app); Pi Browser may not support push. */
export function AppFeatures() {
  const { tr, toast, errMsg, me, refresh } = useApp();
  const [piBusy, setPiBusy] = useState(false);
  const piOn = me?.profile.notify_pi !== false;
  const hour = me?.profile.reminder_hour ?? 17;
  const [hourBusy, setHourBusy] = useState(false);
  const setHour = async (h: number) => {
    setHourBusy(true);
    try { await api("/me", { method: "PATCH", body: { reminder_hour: h } }); await refresh(); } catch (e) { toast(errMsg(e), "err"); } finally { setHourBusy(false); }
  };
  const togglePi = async () => {
    setPiBusy(true);
    try { await api("/me", { method: "PATCH", body: { notify_pi: !piOn } }); await refresh(); } catch (e) { toast(errMsg(e), "err"); } finally { setPiBusy(false); }
  };
  // Separate switches per kind of notification: announcements and celebration notices can be turned off while the daily reminder stays on.
  const newsOn = me?.profile.notify_news !== false;
  const eventsOn = me?.profile.notify_events !== false;
  const [kindBusy, setKindBusy] = useState<string | null>(null);
  const toggleKind = async (field: "notify_news" | "notify_events", on: boolean) => {
    setKindBusy(field);
    try { await api("/me", { method: "PATCH", body: { [field]: !on } }); await refresh(); } catch (e) { toast(errMsg(e), "err"); } finally { setKindBusy(null); }
  };
  const { canPrompt, standalone, ios } = useInstall();
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ok = pushSupported();
    setSupported(ok);
    if (ok) {
      setDenied(Notification.permission === "denied");
      // Already allowed in the browser's settings but not registered yet? Register silently and show any error.
      syncPushIfGranted().then((r) => { setOn(r.registered); if (r.error) setErr(r.error); });
    }
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const r = await enablePush();
      if (r === "ok") { setOn(true); toast(tr("تم تفعيل التذكير اليومي", "Daily reminder is on"), "ok"); }
      else if (r === "denied") setDenied(Notification.permission === "denied");
      else toast(tr("التنبيهات غير مفعّلة حاليًا.", "Reminders are not enabled yet."), "err");
    } catch (e) {
      setErr(describePushError(e));
      toast(errMsg(e), "err");
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true);
    try { await disablePush(); setOn(false); } finally { setBusy(false); }
  };

  // Shows a notification locally (no push involved): tells apart "the phone blocks notifications" from "the push did not arrive".
  const localTest = async () => {
    try {
      const reg = (await navigator.serviceWorker.getRegistration("/sw.js")) ?? (await navigator.serviceWorker.ready);
      await reg.showNotification("Healthy", { body: tr("إشعار تجريبي على هذا الجهاز", "Test notification on this device"), icon: "/icons/icon-192.png", tag: "healthy-local-test" });
    } catch (e) { setErr(describePushError(e)); }
  };

  const doInstall = async () => { await promptInstall(); };

  return (
    <section className="card space-y-4">
      <h2 className="h2">{tr("التطبيق والتذكيرات", "App and reminders")}</h2>
      {!standalone && (
        canPrompt ? (
          <button className="btn-primary w-full" onClick={doInstall}><Icon name="plus" />{tr("ثبّت التطبيق على هاتفك", "Install the app on your phone")}</button>
        ) : (
          <p className="muted">{ios ? tr("على iPhone: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية» لتثبيت التطبيق وتفعيل التذكيرات.", "On iPhone: tap Share, then Add to Home Screen to install the app and enable reminders.") : tr("افتح الموقع من متصفح عادي (مثل Chrome) لتثبيته كتطبيق.", "Open the site in a regular browser (such as Chrome) to install it as an app.")}</p>
        )
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><p className="font-extrabold">{tr("تنبيه داخل تطبيق Pi", "Pi app notification")}</p><p className="muted">{tr("تذكير في مركز إشعارات Pi إذا لم تُكمل تحدي اليوم. يظهر فقط إذا سمحت به داخل Pi.", "A reminder in the Pi Notification Center if you haven't done today's challenge. Shown only if you allowed it inside Pi.")}</p></div>
        <button className={piOn ? "btn-ghost btn-sm" : "btn-primary btn-sm"} disabled={piBusy} onClick={togglePi} aria-pressed={piOn}>{piBusy ? <Spinner size={16} /> : null}{piOn ? tr("إيقاف", "Turn off") : tr("تفعيل", "Turn on")}</button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><p className="font-extrabold">{tr("وقت التذكير", "Reminder time")}</p><p className="muted">{tr("بتوقيتك المحلي. يصلك تذكير واحد في اليوم إن لم تُنجز تحديًا.", "In your local time. One reminder a day if you haven't done a challenge.")}</p></div>
        <select className="field !w-auto !min-h-11" value={hour} disabled={hourBusy} onChange={(e) => setHour(Number(e.target.value))} aria-label={tr("وقت التذكير", "Reminder time")}>
          {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
        </select>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><p className="font-extrabold">{tr("أخبار وعروض Healthy", "Healthy news and offers")}</p><p className="muted">{tr("إعلانات قليلة عن ميزات جديدة. تصل على Pi وعلى أجهزتك.", "Occasional announcements about new features. Sent to Pi and your devices.")}</p></div>
        <button className={newsOn ? "btn-ghost btn-sm" : "btn-primary btn-sm"} disabled={kindBusy === "notify_news"} onClick={() => toggleKind("notify_news", newsOn)} aria-pressed={newsOn}>{kindBusy === "notify_news" ? <Spinner size={16} /> : null}{newsOn ? tr("إيقاف", "Turn off") : tr("تفعيل", "Turn on")}</button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><p className="font-extrabold">{tr("تهنئة بالإنجازات", "Achievement notices")}</p><p className="muted">{tr("إشعار عند وصول سلسلتك لرقم مميز أو إنهاء تحدي الأسبوع.", "A notice when your streak reaches a milestone or you finish the weekly challenge.")}</p></div>
        <button className={eventsOn ? "btn-ghost btn-sm" : "btn-primary btn-sm"} disabled={kindBusy === "notify_events"} onClick={() => toggleKind("notify_events", eventsOn)} aria-pressed={eventsOn}>{kindBusy === "notify_events" ? <Spinner size={16} /> : null}{eventsOn ? tr("إيقاف", "Turn off") : tr("تفعيل", "Turn on")}</button>
      </div>
      {supported ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0"><p className="font-extrabold">{tr("تذكير يومي", "Daily reminder")}</p><p className="muted">{denied ? tr("التنبيهات محظورة من إعدادات المتصفح.", "Notifications are blocked in your browser settings.") : tr("تنبيه واحد في اليوم إذا لم تُكمل تحدي اليوم.", "One notification a day if you haven't done today's challenge.")}</p></div>
          <button className={on ? "btn-ghost btn-sm" : "btn-primary btn-sm"} disabled={busy || denied} onClick={on ? disable : enable} aria-pressed={on}>{busy ? <Spinner size={16} /> : null}{on ? tr("إيقاف", "Turn off") : tr("تفعيل", "Turn on")}</button>
        </div>
      ) : (
        <p className="muted">{tr("هذا المتصفح لا يدعم التنبيهات. جرّب Chrome، أو ثبّت التطبيق على الشاشة الرئيسية.", "This browser doesn't support notifications. Try Chrome, or install the app to your home screen.")}</p>
      )}
      {supported && on && <button className="btn-ghost btn-sm" onClick={localTest}><Icon name="bell" size={16} />{tr("جرّب إشعارًا على هذا الجهاز", "Test a notification on this device")}</button>}
      {err && <p className="muted break-words text-xs" dir="ltr">{tr("تفاصيل الخطأ", "Error details")}: {err}</p>}
    </section>
  );
}
