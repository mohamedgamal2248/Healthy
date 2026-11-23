"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { useApp } from "./AppProvider";

export function Spinner({ size = 22 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="loading">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="skeleton h-28" />
      <div className="skeleton h-24" />
      <div className="skeleton h-24" />
    </div>
  );
}

export function VerifiedBadge({ small }: { small?: boolean }) {
  const { tr } = useApp();
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-brand-50 font-bold text-brand-700 ${small ? "px-1.5 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`} title={tr("باي بايونير موثّق (KYC)", "KYC-verified Pioneer")}>
      <Icon name="shieldCheck" size={small ? 12 : 14} />
      {tr("بايونير", "Pioneer")}
    </span>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="h1">{title}</h1>
        {sub && <p className="muted mt-1">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon name={icon} size={28} />
      </span>
      <p className="h2">{title}</p>
      {body && <p className="muted max-w-sm">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children, icon }: { tone?: "info" | "warn" | "bad" | "ok"; children: ReactNode; icon?: string }) {
  const tones = {
    info: "bg-sky-50 text-sky-600 border-sky-100",
    warn: "bg-sun-50 text-sun-600 border-sun-100",
    bad: "bg-rose-50 text-rose-600 border-rose-100",
    ok: "bg-brand-50 text-brand-700 border-brand-100",
  } as const;
  return (
    <div className={`flex gap-3 rounded-2xl border p-3.5 text-sm font-semibold leading-relaxed ${tones[tone]}`} role={tone === "bad" ? "alert" : undefined}>
      <Icon name={icon ?? (tone === "warn" || tone === "bad" ? "alert" : "info")} size={20} className="mt-0.5 shrink-0" />
      <div className="text-ink">{children}</div>
    </div>
  );
}

/** Wrap a signed-in page: shows the sign-in card for visitors and a skeleton while loading. */
export function Gate({ children, needVerified }: { children: ReactNode; needVerified?: boolean }) {
  const { me, ready, signIn, signingIn, tr, devSignIn } = useApp();
  if (!ready) return <PageSkeleton />;
  if (!me) {
    return (
      <div className="card mx-auto mt-6 flex max-w-md flex-col items-center gap-3 py-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 text-brand-600">
          <Icon name="lock" size={30} />
        </span>
        <h2 className="h2">{tr("سجّل الدخول بحساب Pi", "Sign in with Pi")}</h2>
        <p className="muted">{tr("هذه الصفحة للمستخدمين المسجّلين بحساب Pi فقط.", "This page is for Pi-signed-in users only.")}</p>
        <button className="btn-primary w-full" onClick={signIn} disabled={signingIn}>
          {signingIn ? <Spinner /> : <Icon name="pi" />} {tr("تسجيل الدخول بـ Pi", "Sign in with Pi")}
        </button>
        <DevLogin onLogin={devSignIn} />
        <Link href="/" className="muted underline">{tr("العودة للرئيسية", "Back to home")}</Link>
      </div>
    );
  }
  if (needVerified && !me.profile.kyc_verified) {
    return (
      <div className="mx-auto mt-6 max-w-lg">
        <Notice tone="warn" icon="shieldCheck">{tr("هذه الميزة متاحة فقط لحسابات Pi الموثقة (KYC). أكمل توثيق هويتك في تطبيق Pi ثم سجّل الدخول مرة أخرى.", "This feature is only available to KYC-verified Pi accounts. Complete KYC in the Pi app, then sign in again.")}</Notice>
      </div>
    );
  }
  return <>{children}</>;
}

export function DevLogin({ onLogin }: { onLogin: (u: string, kyc: boolean) => Promise<void> }) {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <button type="button" className="muted underline" onClick={() => onLogin(`dev_${Math.random().toString(36).slice(2, 7)}`, true)}>
      (dev) sign in as a test user
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="muted mt-1 block">{hint}</span>}
    </label>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-ink/40" onClick={onClose} aria-label="close" />
      <div className="pop relative max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="h2">{title}</h2>
          <button className="btn-ghost btn-sm !px-2" onClick={onClose} aria-label="close"><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
