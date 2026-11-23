"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { goToPiAuthorize } from "@/lib/pi-oauth";
import { Spinner } from "@/components/ui";

/** Hands the browser over to Pi Sign-In. See startPiOAuth() for why this extra hop exists. */
export default function SignInStart() {
  const { tr } = useApp();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let u: string;
    try { u = goToPiAuthorize(); } catch { setError(true); return; }
    setUrl(u);
    const t = setTimeout(() => window.location.replace(u), 700);
    return () => clearTimeout(t);
  }, []);
  if (error) return <div className="mx-auto max-w-md py-16 text-center"><div className="card space-y-3"><h1 className="h2">{tr("تسجيل الدخول من المتصفح غير متاح الآن", "Browser sign-in isn't available right now")}</h1><p className="muted">{tr("افتح Healthy من داخل Pi Browser لتسجيل الدخول.", "Open Healthy inside Pi Browser to sign in.")}</p></div></div>;
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="card space-y-4">
        <div className="flex flex-col items-center gap-3"><Spinner size={28} /><p className="muted">{tr("جارٍ فتح تسجيل الدخول بـ Pi…", "Opening Pi Sign-In…")}</p></div>
        {url && <a className="btn-primary w-full" href={url}>{tr("تابع إلى Pi", "Continue to Pi")}</a>}
        <p className="muted">{tr("إذا ظهرت رسالة خطأ في Pi Browser، ارجع إلى هنا واضغط «تابع إلى Pi».", "If Pi Browser shows an error, come back here and tap Continue to Pi.")}</p>
      </div>
    </div>
  );
}
