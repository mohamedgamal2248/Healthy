"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useApp, type Balances } from "./AppProvider";
import { Icon } from "./Icon";
import { Spinner } from "./ui";
import { QUICKSTART_TOTAL } from "@/config/pricing";

type Step = { key: "profile" | "meal" | "reminder"; done: boolean; granted: boolean; credits: number };
type State = { steps: Step[]; earned: number; allGranted: boolean; kyc: boolean; fresh: { key: string; credits: number }[]; referralReward: boolean; balances: Balances | null };
const DONE_KEY = "healthy.qs.done";

/**
 * "Quick start": three small first actions, each worth 1 free AI credit (once per account). The credit arrives the moment the
 * step is finished, and the card disappears for good when all three are done.
 */
export function QuickStart() {
  const { tr, me, toast, errMsg, refresh } = useApp();
  const [s, setS] = useState<State | null>(null);
  const [hidden, setHidden] = useState(true);
  const [hour, setHour] = useState<number>(me?.profile.reminder_hour ?? 17);
  const [busy, setBusy] = useState(false);

  useEffect(() => { try { setHidden(localStorage.getItem(DONE_KEY) === "1"); } catch { setHidden(false); } }, []);
  const load = useCallback(() => {
    api<State>("/quickstart").then((r) => {
      setS(r);
      if (r.fresh.length) {
        const n = r.fresh.reduce((a, f) => a + f.credits, 0);
        toast(tr(`مبروك! كسبت ${n} كريدت Healthy AI مجانًا`, `Nice! You earned ${n} free AI credit${n > 1 ? "s" : ""}`), "ok");
        refresh();
      }
      if (r.referralReward) toast(tr("مكافأة الدعوة: حصلت أنت وصاحبك على كريدت AI إضافي", "Invite reward: you and your friend each got an AI credit"), "ok");
      if (r.allGranted) { try { localStorage.setItem(DONE_KEY, "1"); } catch { /* optional */ } }
    }).catch(() => {});
  }, [tr, toast, refresh]);

  useEffect(() => {
    if (hidden) return;
    load();
    const on = () => load();
    window.addEventListener("healthy:refresh", on);
    window.addEventListener("focus", on);
    return () => { window.removeEventListener("healthy:refresh", on); window.removeEventListener("focus", on); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden]);

  const setReminder = async () => {
    setBusy(true);
    try { await api("/me", { method: "PATCH", body: { reminder_hour: hour } }); await refresh(); load(); } catch (e) { toast(errMsg(e), "err"); } finally { setBusy(false); }
  };

  if (hidden || !s || s.allGranted) return null;
  const by = Object.fromEntries(s.steps.map((x) => [x.key, x])) as Record<Step["key"], Step>;
  const left = QUICKSTART_TOTAL - s.earned;
  const Mark = ({ done }: { done: boolean }) => (<span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-brand-600 bg-brand-600 text-white" : "border-brand-300"}`}>{done && <Icon name="check" size={14} />}</span>);
  const Reward = ({ st }: { st: Step }) => (<span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-extrabold tabular-nums ${st.granted ? "bg-brand-100 text-brand-800" : "bg-sun-50 text-sun-600"}`}>{st.granted ? tr("تم", "Done") : `+${st.credits} ${tr("كريدت AI", "AI credit")}`}</span>);
  return (
    <section className="card space-y-3 !border-sun-100" aria-label={tr("ابدأ واكسب كريدت", "Quick start")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="h2">{tr(`ابدأ واكسب ${QUICKSTART_TOTAL} كريدت Healthy AI مجانًا`, `Start and earn ${QUICKSTART_TOTAL} free Healthy AI credits`)}</h2>
          <p className="muted">{tr(`باقي لك ${left} كريدت AI. كل خطوة تأخد أقل من دقيقة، والكريدت بيوصل فورًا.`, `${left} AI credit${left > 1 ? "s" : ""} left to earn. Each step takes under a minute and the credit arrives right away.`)}</p>
        </div>
        <span className="shrink-0 text-sm font-extrabold tabular-nums" dir="ltr">{s.earned}/{QUICKSTART_TOTAL}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sun-100"><div className="h-full rounded-full bg-sun-500 transition-all" style={{ width: `${(s.earned / QUICKSTART_TOTAL) * 100}%` }} /></div>
      {!s.kyc && <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-bold text-sky-600">{tr("كريدت AI لحسابات Pi الموثّقة (KYC). وثّق حسابك في Pi لتستلمه.", "AI credits are for KYC-verified Pi accounts. Verify your account in Pi to receive them.")}</p>}
      <ul className="space-y-1.5">
        <li><Link href="/profile" className="flex min-h-12 items-center gap-3 rounded-xl px-2 font-bold hover:bg-brand-50"><Mark done={by.profile.done} /><span className={`min-w-0 flex-1 ${by.profile.done ? "text-ink-soft line-through" : ""}`}>{tr("أكمل ملفك الصحي (دقيقة)", "Complete your health profile (1 min)")}</span><Reward st={by.profile} /></Link></li>
        <li><Link href="/diary" className="flex min-h-12 items-center gap-3 rounded-xl px-2 font-bold hover:bg-brand-50"><Mark done={by.meal.done} /><span className={`min-w-0 flex-1 ${by.meal.done ? "text-ink-soft line-through" : ""}`}>{tr("سجّل أول وجبة اليوم", "Log your first meal today")}</span><Reward st={by.meal} /></Link></li>
        <li className="flex min-h-12 flex-wrap items-center gap-3 rounded-xl px-2 font-bold">
          <Mark done={by.reminder.done} />
          <span className={`min-w-0 flex-1 ${by.reminder.done ? "text-ink-soft line-through" : ""}`}>{tr("اختر وقت تذكيرك اليومي", "Choose your daily reminder time")}</span>
          {!by.reminder.granted && (
            <span className="flex items-center gap-2">
              <select className="field !min-h-10 !w-auto !py-1" value={hour} onChange={(e) => setHour(Number(e.target.value))} aria-label={tr("ساعة التذكير", "Reminder hour")}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</select>
              <button className="btn-primary btn-sm" onClick={setReminder} disabled={busy}>{busy ? <Spinner size={16} /> : null}{tr("ثبّت", "Set")}</button>
            </span>
          )}
          <Reward st={by.reminder} />
        </li>
        <li><Link href="/community" className="flex min-h-12 items-center gap-3 rounded-xl px-2 font-bold hover:bg-brand-50"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-brand-300"><Icon name="plus" size={12} /></span><span className="min-w-0 flex-1">{tr("ادعُ صديقًا: كريدت AI لك ولصديقك", "Invite a friend: an AI credit for you and them")}</span><span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-extrabold text-sky-600">{tr("إضافي", "Bonus")}</span></Link></li>
      </ul>
    </section>
  );
}
