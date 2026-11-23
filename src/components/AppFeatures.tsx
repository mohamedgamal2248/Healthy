"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "./AppProvider";
import { promptInstall, useInstall } from "@/lib/pwa-install";
import { disablePush, enablePush, isSubscribed, pushSupported } from "@/lib/push-client";
import { Icon } from "./Icon";
import { Spinner } from "./ui";

/** "Install the app" + daily reminders. Works in an ordinary browser (Chrome, Safari home-screen app); Pi Browser may not support push. */
export function AppFeatures() {
  const { tr, toast, errMsg, me, refresh } = useApp();
  const [piBusy, setPiBusy] = useState(false);
  const piOn = me?.profile.notify_pi !== false;
  const togglePi = async () => {
    setPiBusy(true);
    try { await api("/me", { method: "PATCH", body: { notify_pi: !piOn } }); await refresh(); } catch (e) { toast(errMsg(e), "err"); } finally { setPiBusy(false); }
  };
  const { canPrompt, standalone, ios } = useInstall();
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const ok = pushSupported();
    setSupported(ok);
    if (ok) {
      setDenied(Notification.permission === "denied");
      isSubscribed().then(setOn);
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
      toast(errMsg(e), "err");
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true);
    try { await disablePush(); setOn(false); } finally { setBusy(false); }
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
