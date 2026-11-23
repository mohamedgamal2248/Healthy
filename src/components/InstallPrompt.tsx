"use client";
import { useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { dismissedRecently, promptInstall, rememberDismiss, useInstall } from "@/lib/pwa-install";

/**
 * Right after a Pioneer signs in from an ordinary browser, offer to install Healthy on the phone's home screen.
 * Hidden inside Pi Browser, once installed, and for 14 days after "Not now".
 */
export function InstallPrompt() {
  const { tr, me, toast } = useApp();
  const { canPrompt, ios, standalone, inPiBrowser } = useInstall();
  const [late, setLate] = useState(false);
  const [waited, setWaited] = useState(false);
  const [gone, setGone] = useState(true);
  useEffect(() => {
    setGone(dismissedRecently());
    const t = setTimeout(() => setLate(true), 1500);
    const w = setTimeout(() => setWaited(true), 4500); // some browsers never fire the install event: then explain the manual way
    return () => { clearTimeout(t); clearTimeout(w); };
  }, []);

  const mobile = typeof navigator !== "undefined" && /android|mobile/i.test(navigator.userAgent);
  const manual = !canPrompt && !ios && waited && mobile;
  if (!me || !late || gone || standalone || inPiBrowser || (!canPrompt && !ios && !manual)) return null;

  const install = async () => {
    const r = await promptInstall();
    if (r === "accepted") toast(tr("جارٍ إضافة Healthy إلى شاشتك الرئيسية", "Adding Healthy to your home screen"), "ok");
    else rememberDismiss();
    setGone(true);
  };
  const later = () => { rememberDismiss(); setGone(true); };

  return (
    <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-3xl border border-brand-200 bg-white p-4 shadow-xl lg:bottom-6" role="dialog" aria-label={tr("تثبيت التطبيق", "Install the app")}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Icon name="plus" size={22} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">{tr("ثبّت Healthy على هاتفك", "Install Healthy on your phone")}</p>
          <p className="muted">{ios ? tr("اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».", "Tap Share, then Add to Home Screen.") : manual ? tr("افتح قائمة المتصفح (⋮ أو ≡) ثم اختر «إضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق».", "Open the browser menu (⋮ or ≡), then choose Add to Home screen or Install app.") : tr("يظهر على شاشتك الرئيسية كأي تطبيق، ويفتح بسرعة وبدون شريط المتصفح.", "It appears on your home screen like any app and opens fast, without the browser bar.")}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {!ios && !manual && <button className="btn-primary flex-1" onClick={install}>{tr("تثبيت", "Install")}</button>}
        <button className="btn-ghost flex-1" onClick={later}>{ios || manual ? tr("حسنًا", "Got it") : tr("ليس الآن", "Not now")}</button>
      </div>
    </div>
  );
}
