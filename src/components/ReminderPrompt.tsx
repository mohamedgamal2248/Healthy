"use client";
import { useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { Spinner } from "./ui";
import { enablePush, isSubscribed, markPushAsked, shouldAskPush } from "@/lib/push-client";

/** Right after sign-in, offer the daily reminder with one tap (the browser's permission prompt needs a tap). */
export function ReminderPrompt() {
  const { tr, me, toast, errMsg } = useApp();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!me) return;
    let alive = true;
    const t = setTimeout(async () => { if (alive && shouldAskPush() && !(await isSubscribed())) setShow(true); }, 2000);
    return () => { alive = false; clearTimeout(t); };
  }, [me]);
  if (!show) return null;

  const on = async () => {
    setBusy(true);
    try {
      const r = await enablePush();
      if (r === "ok") toast(tr("تم تفعيل التذكير اليومي", "Daily reminder is on"), "ok");
      else if (r === "not_configured") toast(tr("التنبيهات غير مفعّلة حاليًا.", "Reminders are not enabled yet."), "err");
    } catch (e) { toast(errMsg(e), "err"); }
    finally { setBusy(false); markPushAsked(); setShow(false); }
  };
  const later = () => { markPushAsked(); setShow(false); };

  return (
    <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-3xl border border-brand-200 bg-white p-4 shadow-xl lg:bottom-6" role="dialog" aria-label={tr("تذكير يومي", "Daily reminder")}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Icon name="bell" size={22} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">{tr("فعّل التذكير اليومي", "Turn on the daily reminder")}</p>
          <p className="muted">{tr("إشعار واحد في اليوم إذا لم تُكمل تحدي اليوم، للحفاظ على سلسلتك.", "One notification a day if you haven't done today's challenge, to protect your streak.")}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn-primary flex-1" onClick={on} disabled={busy}>{busy ? <Spinner size={18} /> : null}{tr("تفعيل", "Turn on")}</button>
        <button className="btn-ghost flex-1" onClick={later} disabled={busy}>{tr("ليس الآن", "Not now")}</button>
      </div>
    </div>
  );
}
