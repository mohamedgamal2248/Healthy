"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { goToPiAuthorize } from "@/lib/pi-oauth";
import { Spinner } from "@/components/ui";

/** Hands the browser over to Pi Sign-In. See startPiOAuth() for why this extra hop exists. */
export default function SignInStart() {
  const { tr } = useApp();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = goToPiAuthorize();
    setUrl(u);
    const t = setTimeout(() => window.location.replace(u), 700);
    return () => clearTimeout(t);
  }, []);
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
