"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useGet } from "@/lib/useGet";
import { useApp, type Balances } from "@/components/AppProvider";
import { Gate, Notice, PageSkeleton } from "@/components/ui";
import { BadgeGrid, ChallengeCard, StreakHeader, type ChallengeItem } from "@/components/Challenge";
import { MealCard } from "@/components/MealCard";
import { CreditBalance } from "@/components/Domain";
import { Icon } from "@/components/Icon";
import { BADGES } from "@/data/badges";
import type { MealRow } from "@/server/meals";

type Today = {
  date: string; challenges: ChallengeItem[]; swapUsed: boolean; streak: { current: number; longest: number; total: number }; completedToday: number;
  meals: { breakfast: MealRow | null; lunch: MealRow | null; dinner: MealRow | null }; badges: { badge_key: string }[]; favourites: string[];
  reminder: "none" | "morning" | "inactive"; balances: Balances | null; profileReady: boolean;
  starter: { rewarded: boolean; reward: number };
  checklist: { profile: boolean; challenge: boolean; coach: boolean };
  community: { title_ar: string; title_en: string; members: number; checkedToday: number; joined: boolean; myDays: number } | null;
};

function Checklist({ d }: { d: Today }) {
  const { tr } = useApp();
  const [hidden, setHidden] = useState(true);
  useEffect(() => { try { setHidden(localStorage.getItem("healthy.checklist") === "1"); } catch { setHidden(false); } }, []);
  const steps = [
    { done: d.checklist.profile, ar: "أكمل ملفك الصحي", en: "Complete your health profile", href: "/profile" },
    { done: d.checklist.challenge, ar: "أنجز أول تحدٍّ", en: "Complete your first challenge", href: "/today" },
    { done: d.checklist.coach, ar: "جرّب الكوتش", en: "Try the coach", href: "/chef" },
    { done: d.starter.rewarded, ar: "أكمل تحدي البداية (٧ أيام)", en: "Finish the 7-day starter challenge", href: "/today" },
  ];
  const left = steps.filter((x) => !x.done).length;
  if (hidden || left === 0) return null;
  return (
    <section className="card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="h2">{tr("ابدأ من هنا", "Get started")}</h2>
        <button className="text-xs font-extrabold text-ink-soft underline" onClick={() => { setHidden(true); try { localStorage.setItem("healthy.checklist", "1"); } catch {} }}>{tr("إخفاء", "Hide")}</button>
      </div>
      <ul className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.ar}>
            <Link href={s.href} className="flex min-h-11 items-center gap-3 rounded-xl px-2 font-bold hover:bg-brand-50">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${s.done ? "border-brand-600 bg-brand-600 text-white" : "border-brand-300"}`}>{s.done && <Icon name="check" size={14} />}</span>
              <span className={s.done ? "text-ink-soft line-through" : ""}>{tr(s.ar, s.en)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TodayInner() {
  const { tr, toast, errMsg, lang, me } = useApp();
  const { data: d, setData: setD, reload: load } = useGet<Today>("/today", (e) => toast(errMsg(e), "err"));
  const [busy, setBusy] = useState(false);

  if (!d) return <PageSkeleton />;

  // Instant check-off: the UI updates immediately; the server confirms in the background and we reconcile.
  const done = async (id: string) => {
    const first = d.completedToday === 0;
    setD({
      ...d,
      challenges: d.challenges.map((c) => (c.id === id ? { ...c, status: "completed" as const } : c)),
      completedToday: d.completedToday + 1,
      streak: first ? { ...d.streak, current: d.streak.current + 1, longest: Math.max(d.streak.longest, d.streak.current + 1), total: d.streak.total + 1 } : { ...d.streak, total: d.streak.total + 1 },
    });
    try {
      const r = await api<{ newBadges: string[]; starterReward?: boolean; referralReward?: boolean }>("/challenges/complete", { body: { id } });
      if (r.referralReward) toast(tr("مكافأة الدعوة: حصلت على طلب AI مجاني", "Invite reward: you earned a free AI request"), "ok");
      if (r.starterReward) toast(tr(`مبروك! كسبت ${d.starter.reward} كريدت للشيف AI`, `Congrats! You earned ${d.starter.reward} AI requests`), "ok");
      r.newBadges.forEach((k) => { const b = BADGES.find((x) => x.key === k); if (b) toast(tr(`شارة جديدة: ${b.ar}`, `New badge: ${b.en}`), "ok"); });
      load();
    } catch (e) { toast(errMsg(e), "err"); load(); }
  };
  const swap = async (id: string) => {
    setBusy(true);
    try { await api("/challenges/swap", { body: { id } }); await load(); toast(tr("تم تبديل التحدي", "Challenge swapped"), "ok"); }
    catch (e) { toast(errMsg(e), "err"); } finally { setBusy(false); }
  };
  const fav = async (id: string) => {
    const was = d.favourites.includes(id);
    setD({ ...d, favourites: was ? d.favourites.filter((x) => x !== id) : [...d.favourites, id] });
    try { await api("/favourites", { body: { type: "meal", id } }); } catch (e) { toast(errMsg(e), "err"); load(); }
  };

  const allDone = d.challenges.length > 0 && d.completedToday === d.challenges.length;
  const slots: ["breakfast" | "lunch" | "dinner", string][] = [["breakfast", tr("فطار", "Breakfast")], ["lunch", tr("غدا", "Lunch")], ["dinner", tr("عشا", "Dinner")]];

  return (
    <div className="space-y-6 py-5">
      {!d.profileReady && (
        <Notice tone="warn" icon="user">
          <div className="flex flex-wrap items-center gap-3"><span>{tr("أكمل ملفك الصحي وأكّد التنبيه الصحي لتفعيل الكوتش والنظام الغذائي.", "Complete your health profile and accept the disclaimer to unlock the AI Coach and diet plan.")}</span><Link href="/profile" className="btn-primary btn-sm">{tr("أكمل الملف", "Complete profile")}</Link></div>
        </Notice>
      )}
      {d.reminder === "inactive" && (
        <Notice tone="info" icon="bell">{tr("وحشتنا! لسه تحديات النهاردة مستنياك، وكل يوم جديد فرصة جديدة. ابدأ بتحدي واحد بس.", "We missed you! Today's challenges are waiting; every day is a fresh start. Begin with just one.")}</Notice>
      )}

      <StreakHeader current={d.streak.current} longest={d.streak.longest} total={d.streak.total} doneToday={d.completedToday} />

      <Checklist d={d} />

      {!d.starter.rewarded && me?.profile.kyc_verified && (
        <section className="card !border-sun-100 bg-gradient-to-br from-sun-50 to-white">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sun-500 text-white"><Icon name="bolt" size={26} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">{tr(`تحدي البداية: اكسب ${d.starter.reward} كريدت للشيف AI`, `Starter challenge: earn ${d.starter.reward} free AI requests`)}</p>
              <p className="muted">{tr("أنجز تحديًا واحدًا على الأقل كل يوم لمدة ٧ أيام متتالية.", "Complete at least one challenge every day for 7 days in a row.")}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3"><div className="h-3 flex-1 overflow-hidden rounded-full bg-sun-100"><div className="h-full rounded-full bg-sun-500 transition-all" style={{ width: `${Math.min(100, (d.streak.current / 7) * 100)}%` }} /></div><span className="text-sm font-extrabold tabular-nums">{Math.min(d.streak.current, 7)}/7</span></div>
        </section>
      )}

      <section aria-labelledby="ch">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 id="ch" className="h2">{tr("تحدي اليوم", "Today's challenges")}</h2>
            <p className="muted">{d.reminder === "morning" && !allDone ? tr("تحدي النهاردة مستنيك", "Today's challenge is waiting for you") : allDone ? tr("أنجزت كل تحديات اليوم. شاطر!", "All of today's challenges are done. Great job!") : tr("نفّذ تحديًا واحدًا على الأقل للحفاظ على سلسلتك", "Complete at least one to keep your streak")}</p>
          </div>
          <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-extrabold text-brand-800 tabular-nums">{d.completedToday}/{d.challenges.length}</span>
        </div>
        <div className="space-y-2.5">
          {d.challenges.map((c) => (<ChallengeCard key={c.id} c={c} onDone={done} onSwap={swap} canSwap={!d.swapUsed} busy={busy} />))}
        </div>
        <p className="muted mt-2">{d.swapUsed ? tr("استخدمت تبديل اليوم.", "You used today's swap.") : tr("تقدر تبدّل تحديًا واحدًا اليوم.", "You can swap one challenge today.")}</p>
      </section>

      <section aria-labelledby="ml">
        <div className="mb-3 flex items-end justify-between"><h2 id="ml" className="h2">{tr("وجبات اليوم", "Meals of the day")}</h2><Link href="/meals" className="text-sm font-extrabold text-brand-700">{tr("كل الوجبات", "All meals")}</Link></div>
        <div className="grid gap-4 md:grid-cols-3">
          {slots.map(([k, label]) => d.meals[k] ? <MealCard key={k} meal={d.meals[k]!} label={label} fav={d.favourites.includes(d.meals[k]!.id)} onFav={fav} /> : null)}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Link href="/chef" className="card flex items-center gap-4 !border-brand-200 bg-gradient-to-br from-brand-50 to-white transition hover:shadow-md">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white"><Icon name="chef" size={30} /></span>
          <div className="flex-1">
            <p className="h2">{tr("الكوتش", "AI Coach")}</p>
            <p className="muted">{tr("وجبات وتمارين وتحديات على مقاسك", "Meals, workouts and challenges made for you")}</p>
          </div>
          <Icon name={lang === "ar" ? "chevronL" : "chevronR"} size={22} className="text-brand-600" />
        </Link>
        {me?.profile.kyc_verified && d.balances && <CreditBalance b={d.balances} />}
      </section>

      {d.community && (
        <Link href="/community" className="card flex items-center gap-4 !border-sun-100 bg-gradient-to-br from-sun-50 to-white transition hover:shadow-md">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sun-500 text-white"><Icon name="users" size={28} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-sun-600">{tr("تحدي الأسبوع الجماعي", "Weekly group challenge")}</p>
            <p className="truncate font-extrabold">{lang === "ar" ? d.community.title_ar : d.community.title_en}</p>
            <p className="muted">{d.community.joined ? tr(`أنت في اليوم ${d.community.myDays} من ٧`, `You're at day ${d.community.myDays} of 7`) : tr("انضم بضغطة واحدة", "Join with one tap")} · {tr(`${d.community.members} بايونير، ${d.community.checkedToday} سجّلوا اليوم`, `${d.community.members} pioneers, ${d.community.checkedToday} checked in today`)}</p>
          </div>
          <Icon name={lang === "ar" ? "chevronL" : "chevronR"} size={22} className="text-sun-600" />
        </Link>
      )}

      <section><h2 className="h2 mb-3">{tr("شاراتك", "Your badges")}</h2><BadgeGrid earned={d.badges} /></section>
    </div>
  );
}

export default function TodayPage() {
  return <Gate><TodayInner /></Gate>;
}
