"use client";
import { useEffect } from "react";
import { Icon } from "@/components/Icon";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Reaches the server log (Vercel) so client crashes are not invisible.
    fetch("/api/client-error", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: error.message?.slice(0, 300), digest: error.digest, path: location.pathname }) }).catch(() => {});
  }, [error]);
  return (
    <div className="mx-auto mt-10 flex max-w-sm flex-col items-center gap-3 rounded-3xl border border-line bg-white p-8 text-center shadow-sm">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><Icon name="alert" size={28} /></span>
      <h2 className="text-lg font-extrabold">حصلت مشكلة غير متوقعة / Something went wrong</h2>
      <p className="text-sm text-ink-soft">جرّب مرة أخرى. لو استمرت المشكلة، ارجع للرئيسية. / Try again, or go back home.</p>
      <div className="flex w-full gap-2">
        <button className="btn-primary flex-1" onClick={reset}>إعادة المحاولة / Retry</button>
        <a href="/" className="btn-soft flex-1">الرئيسية / Home</a>
      </div>
    </div>
  );
}
