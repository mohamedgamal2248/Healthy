"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { readOAuthCallback } from "@/lib/pi-oauth";
import { Spinner } from "@/components/ui";

/** Landing page for Pi Sign-In (redirect URI). Exchanges the token for a Healthy session, then moves on. */
export default function SignInCallback() {
  const { tr, signInWithToken } = useApp();
  const [failed, setFailed] = useState<string | null>(null);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const r = readOAuthCallback();
    if (!r.ok) { setFailed(r.error); return; }
    signInWithToken(r.accessToken).then((ok) => { if (!ok) setFailed("signin_failed"); });
  }, [signInWithToken]);
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      {failed ? (
        <div className="card space-y-3">
          <h1 className="h2">{tr("تعذّر تسجيل الدخول", "Sign-in did not complete")}</h1>
          <p className="muted">{failed === "access_denied" || failed === "cancelled" ? tr("ألغيت تسجيل الدخول.", "You cancelled the sign-in.") : tr("حاول مرة أخرى.", "Please try again.")}</p>
          <Link href="/" className="btn-primary">{tr("العودة", "Back")}</Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3"><Spinner size={28} /><p className="muted">{tr("جارٍ تسجيل دخولك…", "Signing you in…")}</p></div>
      )}
    </div>
  );
}
