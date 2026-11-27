"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useGet } from "@/lib/useGet";
import { useApp, type Balances } from "@/components/AppProvider";
import { Gate, Notice, PageSkeleton, Spinner } from "@/components/ui";
import { CalorieCard, FoodTile, MacroRings, WeekStrip } from "@/components/Rings";
import { useRouter } from "next/navigation";
import { ChallengeCard, StreakHeader, type ChallengeItem } from "@/components/Challenge";
import { MealCard } from "@/components/MealCard";
import { CreditBalance } from "@/components/Domain";
import { Icon } from "@/components/Icon";
import { QuickStart } from "@/components/QuickStart";
import { BADGES } from "@/data/badges";
import type { MealRow } from "@/server/meals";

type RecentFood = { id: string; name: string; name_ar?: string; name_en?: string; calories: number; protein_g: number; source: "meal" | "scan" | "manual"; estimated: boolean };

type Today = {
  date: string; challenges: ChallengeItem[]; swapUsed: boolean; streak: { current: number; longest: number; total: number; frozen?: boolean; freezeReady?: boolean }; completedToday: number;
  meals: { breakfast: (MealRow & { servings?: number }) | null; lunch: (MealRow & { servings?: number }) | null; dinner: (MealRow & { servings?: number }) | null }; mealsFromPlan?: boolean; snacks?: { id: string | null; name_ar: string; name_en: string; servings: number; calories: number; protein_g: number }[]; autolog?: boolean; badges: { badge_key: string }[]; favourites: string[];
  reminder: "none" | "morning" | "inactive"; balances: Balances | null; profileReady: boolean;
  starter: { rewarded: boolean; reward: number };
  food?: { calories: number; target: number | null; entries: number; totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number }; targets: { protein: number; carbs: number; fat: number } | null; recent: RecentFood[] };
  week?: { date: string; challenge: boolean; food: boolean }[];
  checklist: { profile: boolean; challenge: boolean; coach: boolean };
  community: { title_ar: string; title_en: string; members: number; checkedToday: number; joined: boolean; myDays: number } | null;
};

/** One clear next step. The first thing that applies wins, so the screen never feels like a to-do list. */
function NextStep({ d }: { d: Today }) {
  const { tr } = useApp();
  const left = d.challenges.filter((c) => c.status !== "completed").length;
  let step: { ar: string; en: string; href: string; icon: "user" | "flame" | "utensils" | "trophy" } | null = null;
  if (!d.profileReady) step = { ar: "أكمل ملفك الصحي (دقيقة واحدة)", en: "Complete your health profile (1 minute)", href: "/profile", icon: "user" };
  else if (left > 0) step = { ar: left === 1 ? "تحدٍّ واحد باقي اليوم" : `${left} تحديات باقية اليوم`, en: left === 1 ? "One challenge left today" : `${left} challenges left today`, href: "#ch", icon: "flame" };
  if (!step) return null;
  const inner = (<><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white"><Icon name={step.icon} size={22} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-extrabold text-brand-700">{tr("خطوتك الآن", "Your next step")}</span><span className="block font-extrabold">{tr(step.ar, step.en)}</span></span><Icon name="chevronR" size={20} className="text-brand-600 rtl:rotate-180" /></>);
  return step.href.startsWith("#") ? <a href={step.href} className="card flex items-center gap-3 !border-brand-200 !p-3.5">{inner}</a> : <Link href={step.href} className="card flex items-center gap-3 !border-brand-200 !p-3.5">{inner}</Link>;
}

/** Last meals with a one-tap "repeat" (copied on the server from the user's own entry). */
function RecentMeals({ items, onRepeat, busy }: { items: RecentFood[]; onRepeat: (id: string) => void; busy: string | null }) {
  const { tr, lang } = useApp();
  if (!items.length) return null;
  return (
    <section aria-labelledby="rm">
      <div className="mb-2.5 flex items-end justify-between"><h2 id="rm" className="h2">{tr("آخر وجباتك", "Recent meals")}</h2><Link href="/diary" className="text-sm font-extrabold text-brand-700">{tr("الكل", "All")}</Link></div>
      <ul className="space-y-2">
        {items.slice(0, 2).map((m) => (
          <li key={m.id} className="card-row !min-h-16">
            <FoodTile source={m.source} size={44} />
            <div className="min-w-0 flex-1"><p className="truncate font-extrabold">{(lang === "ar" ? m.name_ar : m.name_en) ?? m.name}</p><p className="muted tabular-nums">{m.calories} {tr("سعرة", "kcal")} · {Math.round(m.protein_g)}{tr("ج بروتين", "g protein")}</p></div>
            <button className="btn-soft btn-sm !min-h-9 !px-3" onClick={() => onRepeat(m.id)} disabled={busy !== null} aria-label={tr(`كرر ${m.name}`, `Repeat ${m.name}`)}>{busy === m.id ? <Spinner size={16} /> : <Icon name="refresh" size={16} />}{tr("كرر", "Repeat")}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TodayInner() {
  const { tr, toast, errMsg, lang, me } = useApp();
  const { data: d, setData: setD, reload: load } = useGet<Today>("/today", (e) => toast(errMsg(e), "err"));
  // Once a day the plan's meals are put into the diary, so the counters below follow the plan (the person can edit or remove them).
  const autologRan = useRef(false);
  const wantsAutolog = !!d?.autolog;
  useEffect(() => {
    if (!wantsAutolog || autologRan.current) return;
    autologRan.current = true;
    api<{ added: number }>("/food/autolog", { body: {} }).then((r) => { if (r.added > 0) { load(); toast(tr("أضفنا وجبات خطتك اليوم إلى يومياتك. عدّلها أو احذفها من صفحة يومي.", "We added today's plan meals to your diary. Edit or remove them on My day."), "ok"); } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsAutolog]);
  const [busy, setBusy] = useState(false);
  const [repeating, setRepeating] = useState<string | null>(null);
  const router = useRouter();

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
      if (r.starterReward) toast(tr(`مبروك! كسبت ${d.starter.reward} كريدت لـ Healthy AI`, `Congrats! You earned ${d.starter.reward} AI requests`), "ok");
      r.newBadges.forEach((k) => { const b = BADGES.find((x) => x.key === k); if (b) toast(tr(`شارة جديدة: ${b.ar}`, `New badge: ${b.en}`), "ok"); });
      load();
    } catch (e) { toast(errMsg(e), "err"); load(); }
  };
  const swap = async (id: string) => {
    setBusy(true);
    try { await api("/challenges/swap", { body: { id } }); await load(); toast(tr("تم تبديل التحدي", "Challenge swapped"), "ok"); }
    catch (e) { toast(errMsg(e), "err"); } finally { setBusy(false); }
  };
  const repeat = async (entryId: string) => {
    setRepeating(entryId);
    try { await api("/food", { body: { source: "repeat", entryId } }); toast(tr("تمت إضافتها ليومك", "Added to your day"), "ok"); await load(); }
    catch (e) { toast(errMsg(e), "err"); } finally { setRepeating(null); }
  };
  const fav = async (id: string) => {
    const was = d.favourites.includes(id);
    setD({ ...d, favourites: was ? d.favourites.filter((x) => x !== id) : [...d.favourites, id] });
    try { await api("/favourites", { body: { type: "meal", id } }); } catch (e) { toast(errMsg(e), "err"); load(); }
  };

  const allDone = d.challenges.length > 0 && d.completedToday === d.challenges.length;
  const slots: ["breakfast" | "lunch" | "dinner", string][] = [["breakfast", tr("فطار", "Breakfast")], ["lunch", tr("غدا", "Lunch")], ["dinner", tr("عشا", "Dinner")]];

  return (
    <div className="space-y-5 py-5">
      {!d.profileReady && (
        <Notice tone="warn" icon="user">
          <div className="flex flex-wrap items-center gap-3"><span>{tr("أكمل ملفك الصحي وأكّد التنبيه الصحي لتفعيل Healthy AI والنظام الغذائي.", "Complete your health profile and accept the disclaimer to unlock Healthy AI and diet plan.")}</span><Link href="/profile" className="btn-primary btn-sm">{tr("أكمل الملف", "Complete profile")}</Link></div>
        </Notice>
      )}
      {d.reminder === "inactive" && (
        <Notice tone="info" icon="bell">{tr("وحشتنا! لسه تحديات النهاردة مستنياك، وكل يوم جديد فرصة جديدة. ابدأ بتحدي واحد بس.", "We missed you! Today's challenges are waiting; every day is a fresh start. Begin with just one.")}</Notice>
      )}

      {/* 1 · Week strip + streak (falls back to the big streak card if the server is older) */}
      {d.week ? <WeekStrip week={d.week} today={d.date} streak={d.streak.current} frozen={d.streak.frozen} freezeReady={d.streak.freezeReady} /> : <StreakHeader current={d.streak.current} longest={d.streak.longest} total={d.streak.total} doneToday={d.completedToday} frozen={d.streak.frozen} freezeReady={d.streak.freezeReady} />}

      {/* One next step (profile, then challenges) */}
      <NextStep d={d} />

      {/* 2 · Calories + macros (macros only once something is logged) */}
      {d.food && (
        <div className="space-y-2.5">
          <CalorieCard totals={d.food.totals} target={d.food.target} entries={d.food.entries} onAdd={() => router.push("/diary?add=meals")} />
          {d.food.entries > 0 && <Link href="/diary" aria-label={tr("افتح يومي", "Open My day")} className="block"><MacroRings totals={d.food.totals} targets={d.food.targets} estimated /></Link>}
        </div>
      )}


      <QuickStart />

      {!d.starter.rewarded && me?.profile.kyc_verified && (
        <section className="card-row !border-sun-100 !bg-sun-50/60">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sun-500 text-white"><Icon name="bolt" size={22} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold leading-snug">{tr(`تحدي البداية: ${d.starter.reward} كريدت Healthy AI مجانًا`, `Starter challenge: ${d.starter.reward} free AI requests`)}</p>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sun-100"><div className="h-full rounded-full bg-sun-500 transition-all" style={{ width: `${Math.min(100, (d.streak.current / 7) * 100)}%` }} /></div>
          </div>
          <span className="text-sm font-extrabold tabular-nums">{Math.min(d.streak.current, 7)}/7</span>
        </section>
      )}

      {/* 3 · Today's challenges as compact rows (kept high: they are what makes Healthy different) */}
      <section aria-labelledby="ch">
        <div className="mb-2.5 flex items-end justify-between gap-3">
          <div>
            <h2 id="ch" className="h2">{tr("تحدي اليوم", "Today's challenges")}</h2>
            <p className="muted">{d.reminder === "morning" && !allDone ? tr("تحدي النهاردة مستنيك", "Today's challenge is waiting for you") : allDone ? tr("أنجزت كل تحديات اليوم. شاطر!", "All of today's challenges are done. Great job!") : tr("نفّذ تحديًا واحدًا على الأقل للحفاظ على سلسلتك", "Complete at least one to keep your streak")}</p>
          </div>
          <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-extrabold text-brand-800 tabular-nums">{d.completedToday}/{d.challenges.length}</span>
        </div>
        <div className="space-y-2">
          {d.challenges.map((c) => (<ChallengeCard key={c.id} c={c} onDone={done} onSwap={swap} canSwap={!d.swapUsed} busy={busy} />))}
        </div>
        <p className="muted mt-2">{d.swapUsed ? tr("استخدمت تبديل اليوم.", "You used today's swap.") : tr("تقدر تبدّل تحديًا واحدًا اليوم.", "You can swap one challenge today.")}</p>
      </section>

      {/* 4 · Recent meals with one-tap repeat */}
      {d.food && <RecentMeals items={d.food.recent} onRepeat={repeat} busy={repeating} />}

      {/* Everything else, one tap away */}
      <details className="card group !p-0">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 font-extrabold [&::-webkit-details-marker]:hidden">
          <span>{tr("المزيد", "More")}</span>
          <Icon name="chevronD" size={20} className="text-ink-soft transition group-open:rotate-180" />
        </summary>
        <div className="space-y-5 border-t border-line p-4">
          <section aria-labelledby="ml">
            <div className="mb-3 flex items-end justify-between"><h2 id="ml" className="h2">{d.mealsFromPlan ? tr("وجبات خطتك اليوم", "Today's meals from your plan") : tr("وجبات اليوم", "Meals of the day")}</h2><Link href={d.mealsFromPlan ? "/plan" : "/meals"} className="text-sm font-extrabold text-brand-700">{d.mealsFromPlan ? tr("خطتي الأسبوعية", "My weekly plan") : tr("كل الوجبات", "All meals")}</Link></div>
            <div className="grid gap-4 md:grid-cols-3">
              {slots.map(([k, label]) => d.meals[k] ? <MealCard key={k} meal={d.meals[k]!} label={d.mealsFromPlan && d.meals[k]!.servings ? `${label} · ${tr("حصة", "portion")} ×${d.meals[k]!.servings}` : label} fav={d.favourites.includes(d.meals[k]!.id)} onFav={fav} /> : null)}
            </div>
            {d.snacks && d.snacks.length > 0 && (
              <div className="mt-3 rounded-2xl border border-line bg-white px-3 py-2">
                <p className="text-xs font-extrabold text-ink-soft">{tr("سناك اليوم", "Today's snacks")}</p>
                <ul className="divide-y divide-line">
                  {d.snacks.map((s, i) => (
                    <li key={`${s.id ?? s.name_en}-${i}`} className="flex items-center gap-2 py-1.5 text-sm">
                      <Icon name="leaf" size={15} className="shrink-0 text-brand-600" />
                      <span className="min-w-0 flex-1 truncate font-bold">{lang === "ar" ? s.name_ar : s.name_en}</span>
                      <span className="shrink-0 text-xs font-bold tabular-nums text-ink-soft">{s.calories} {tr("سعرة", "kcal")} · {Math.round(s.protein_g)} {tr("جم", "g")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {d.community && (
            <Link href="/community" className="card-row !min-h-16 !border-sun-100 !bg-sun-50/60">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sun-500 text-white"><Icon name="users" size={22} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-sun-600">{tr("تحدي الأسبوع الجماعي", "Weekly group challenge")}</p>
                <p className="truncate font-extrabold">{lang === "ar" ? d.community.title_ar : d.community.title_en}</p>
                <p className="muted truncate">{d.community.joined ? tr(`أنت في اليوم ${d.community.myDays} من ٧`, `You're at day ${d.community.myDays} of 7`) : tr("انضم بضغطة واحدة", "Join with one tap")} · {tr(`${d.community.members} بايونير`, `${d.community.members} pioneers`)}</p>
              </div>
              <Icon name={lang === "ar" ? "chevronL" : "chevronR"} size={20} className="text-sun-600" />
            </Link>
          )}

          {me?.profile.kyc_verified && d.balances && <CreditBalance b={d.balances} />}

          <Link href="/progress" className="card-row"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sun-50 text-sun-600"><Icon name="trophy" size={22} /></span><span className="flex-1 font-extrabold">{tr(`شاراتك (${d.badges.length}/${BADGES.length})`, `Your badges (${d.badges.length}/${BADGES.length})`)}</span><Icon name={lang === "ar" ? "chevronL" : "chevronR"} size={20} className="text-ink-soft" /></Link>
        </div>
      </details>
    </div>
  );
}

export default function TodayPage() {
  return <Gate><TodayInner /></Gate>;
}
