"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, Logo } from "./Icon";
import { useApp } from "./AppProvider";
import { Sheet, Spinner } from "./ui";

const MAIN = [
  { href: "/today", icon: "home", ar: "اليوم", en: "Today" },
  { href: "/meals", icon: "utensils", ar: "وجبات", en: "Meals" },
  { href: "/chef", icon: "sparkles", ar: "الكوتش", en: "Coach" },
  { href: "/progress", icon: "chart", ar: "تقدمي", en: "Progress" },
];
const MORE = [
  { href: "/plan", icon: "plan", ar: "نظامي الغذائي", en: "My diet plan" },
  { href: "/community", icon: "users", ar: "المجتمع", en: "Community" },
  { href: "/library", icon: "book", ar: "مكتبتي", en: "Library" },
  { href: "/pricing", icon: "coin", ar: "الأسعار والباقات", en: "Pricing" },
  { href: "/wallet", icon: "wallet", ar: "المحفظة", en: "Wallet" },
  { href: "/profile", icon: "user", ar: "ملفي الصحي", en: "Health profile" },
];

export function Shell({ children }: { children: ReactNode }) {
  const { me, ready, lang, setLang, tr, signIn, signingIn, signOut } = useApp();
  const path = usePathname();
  const [more, setMore] = useState(false);
  const bare = path.startsWith("/r/"); // public shared recipe: minimal chrome
  const signedIn = !!me;
  const items = [...MAIN.slice(0, 3), MORE[0], ...MAIN.slice(3), ...MORE.slice(1)];
  if (me?.isAdmin) items.push({ href: "/admin", icon: "settings", ar: "الإدارة", en: "Admin" });
  const active = (h: string) => path === h || path.startsWith(h + "/");

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href={signedIn ? "/today" : "/"} className="flex items-center gap-2.5">
            <Logo />
            <span className="text-xl font-extrabold tracking-tight text-brand-800" dir="ltr">Healthy</span>
          </Link>
          <div className="flex items-center gap-2">
            {me?.balances && (
              <Link href="/pricing" className="chip !border-sun-100 !bg-sun-50 !text-sun-600" aria-label={tr("رصيد الكريدت", "Credit balance")}>
                <Icon name="bolt" size={16} />
                <span className="font-extrabold tabular-nums">{me.balances.total}</span>
                <span className="hidden sm:inline">{tr("كريدت", "credits")}</span>
              </Link>
            )}
            <button className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-xs font-extrabold text-ink-soft transition active:scale-90" onClick={() => setLang(lang === "ar" ? "en" : "ar")} aria-label={tr("تغيير اللغة", "Switch language")} dir="ltr">
              {lang === "ar" ? "EN" : "AR"}
            </button>
            {!signedIn && ready && (
              <>
                <Link href="/pricing" className="btn-ghost btn-sm hidden sm:inline-flex">{tr("الأسعار", "Pricing")}</Link>
                <button className="btn-primary btn-sm" onClick={signIn} disabled={signingIn}>
                  {signingIn ? <Spinner size={16} /> : <Icon name="pi" size={16} />}
                  <span>{tr("دخول بـ Pi", "Sign in")}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4">
        {signedIn && !bare && (
          <aside className="sticky top-20 hidden h-[calc(100dvh-6rem)] w-60 shrink-0 flex-col gap-1 py-6 lg:flex">
            {items.map((i) => (
              <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 font-bold transition ${active(i.href) ? "bg-brand-600 text-white shadow-sm" : "text-ink-soft hover:bg-brand-50"}`}>
                <Icon name={i.icon} size={20} /> {tr(i.ar, i.en)}
              </Link>
            ))}
            <div className="mt-auto border-t border-line pt-3">
              <p className="mb-2 truncate px-2 text-sm font-bold text-ink-soft"><bdi dir="ltr">@{me.profile.username}</bdi></p>
              <button className="btn-ghost w-full justify-start" onClick={signOut}><Icon name="logout" size={18} />{tr("تسجيل الخروج", "Sign out")}</button>
            </div>
          </aside>
        )}
        <main className={`min-w-0 flex-1 ${signedIn && !bare ? "pb-28 lg:pb-10" : "pb-10"}`}>{children}</main>
      </div>

      {signedIn && !bare && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label={tr("التنقل", "Navigation")}>
          <ul className="mx-auto grid max-w-lg grid-cols-5">
            {MAIN.map((i) => (
              <li key={i.href}>
                <Link href={i.href} aria-current={active(i.href) ? "page" : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${active(i.href) ? "text-brand-700" : "text-ink-soft"}`}>
                  <span className={`flex h-8 w-12 items-center justify-center rounded-full transition ${active(i.href) ? "bg-brand-100" : ""}`}><Icon name={i.icon} size={22} /></span>
                  {tr(i.ar, i.en)}
                </Link>
              </li>
            ))}
            <li>
              <button onClick={() => setMore(true)} className="flex min-h-16 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-bold text-ink-soft">
                <span className="flex h-8 w-12 items-center justify-center"><Icon name="menu" size={22} /></span>
                {tr("المزيد", "More")}
              </button>
            </li>
          </ul>
        </nav>
      )}

      <Sheet open={more} onClose={() => setMore(false)} title={tr("المزيد", "More")}>
        <div className="grid grid-cols-2 gap-2">
          {[...MORE, ...(me?.isAdmin ? [{ href: "/admin", icon: "settings", ar: "الإدارة", en: "Admin" }] : [])].map((i) => (
            <Link key={i.href} href={i.href} onClick={() => setMore(false)} className="flex min-h-14 items-center gap-2.5 rounded-2xl border border-line bg-brand-50/40 px-3 font-bold text-ink">
              <Icon name={i.icon} size={20} className="text-brand-600" /> {tr(i.ar, i.en)}
            </Link>
          ))}
        </div>
        <button className="btn-soft mt-3 w-full" onClick={() => { setMore(false); signOut(); }}><Icon name="logout" size={18} />{tr("تسجيل الخروج", "Sign out")}</button>
      </Sheet>
    </div>
  );
}
