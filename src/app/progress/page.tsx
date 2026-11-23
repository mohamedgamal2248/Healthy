"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useGet } from "@/lib/useGet";
import { useApp } from "@/components/AppProvider";
import { Field, Gate, PageHeader, PageSkeleton, Spinner } from "@/components/ui";
import { BadgeGrid } from "@/components/Challenge";
import { WeightChart } from "@/components/Domain";
import { Icon } from "@/components/Icon";
import { WeeklyCard } from "@/components/WeeklyCard";

type P = {
  today: string; weights: { weight_kg: number; logged_date: string; is_official: boolean }[]; habitToday: { water_cups: number | null; sleep_hours: number | null; steps: number | null } | null;
  habitsWeek: { date: string; water_cups: number | null }[]; weekDays: string[]; streak: { current: number; longest: number; total: number }; badges: { badge_key: string }[]; waterTarget: number;
  goal?: "lose" | "gain" | "maintain" | null; calories?: { avg7: number | null; daysLogged: number; target: number | null };
};

const goalLabel = (g: string, l: "ar" | "en") => ({ lose: ["خسارة وزن", "lose weight"], gain: ["زيادة وزن", "gain weight"], maintain: ["ثبات الوزن", "keep weight"] } as Record<string, [string, string]>)[g]?.[l === "ar" ? 0 : 1] ?? "";

/** Kind words only. A gain while trying to lose gets encouragement, never blame (people quit tracking after bad news). */
function encouragement(goal: string | null, delta: number | null, days: number, tr: (ar: string, en: string) => string): { text: string; tone: "good" | "soft" } | null {
  if (delta === null) return null;
  const span = days === 30 ? tr("آخر ٣٠ يوم", "the last 30 days") : days === 90 ? tr("آخر ٣ شهور", "the last 3 months") : tr("آخر سنة", "the last year");
  const kg = Math.abs(delta).toFixed(1);
  const toward = goal === "lose" ? delta < 0 : goal === "gain" ? delta > 0 : Math.abs(delta) <= 1;
  if (toward) return { tone: "good", text: goal === "maintain" ? tr(`وزنك ثابت في ${span}. الاستمرار هو السر.`, `Your weight is steady over ${span}. Consistency is the secret.`) : tr(`${goal === "lose" ? "نزلت" : "زدت"} ${kg} كجم في ${span}. أحسنت، كمّل كده.`, `${goal === "lose" ? "Down" : "Up"} ${kg} kg over ${span}. Great work, keep going.`) };
  return { tone: "soft", text: tr("الوزن بيتغير من يوم ليوم لأسباب كتير زي المياه والملح. ركّز على عاداتك هذا الأسبوع، والنتيجة هتيجي.", "Weight moves day to day for many reasons like water and salt. Focus on this week's habits; results follow.") };
}

/** Seven small dots: gold for days with a completed challenge. */
function MiniWeek({ today, done }: { today: string; done: string[] }) {
  const days = Array.from({ length: 7 }, (_, i) => { const x = new Date(`${today}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - (6 - i)); return x.toISOString().slice(0, 10); });
  return <div className="mt-2 flex justify-center gap-1" aria-hidden="true">{days.map((d) => <span key={d} className={`h-2.5 w-2.5 rounded-full ${done.includes(d) ? "bg-sun-500" : "bg-line"}`} />)}</div>;
}

function Inner() {
  const { tr, toast, errMsg, me } = useApp();
  const { data: d, setData: setD, reload: load } = useGet<P>("/progress", (e) => toast(errMsg(e), "err"));
  const [w, setW] = useState("");
  const [sleep, setSleep] = useState("");
  const [steps, setSteps] = useState("");
  const [range, setRange] = useState<30 | 90 | 365>(90);
  // Opened from the floating "+" (/progress#weight): bring the weight form into view once data is on screen.
  const loaded = !!d;
  useEffect(() => {
    if (!loaded || window.location.hash !== "#weight") return;
    const el = document.getElementById("weight");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    el?.querySelector("input")?.focus({ preventScroll: true });
  }, [loaded]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (d) { setSleep(d.habitToday?.sleep_hours?.toString() ?? ""); setSteps(d.habitToday?.steps?.toString() ?? ""); } }, [d?.today, d?.habitToday?.sleep_hours, d?.habitToday?.steps]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <PageSkeleton />;

  const cups = d.habitToday?.water_cups ?? 0;
  const setCups = async (n: number) => { const v = Math.max(0, Math.min(40, n)); setD({ ...d, habitToday: { ...(d.habitToday ?? { sleep_hours: null, steps: null }), water_cups: v } }); try { await api("/habits", { body: { water_cups: v } }); } catch (e) { toast(errMsg(e), "err"); load(); } };
  const saveHabits = async () => {
    setBusy(true);
    try { await api("/habits", { body: { ...(sleep !== "" ? { sleep_hours: Number(sleep) } : {}), ...(steps !== "" ? { steps: Math.round(Number(steps)) } : {}) } }); toast(tr("تم حفظ عادات اليوم", "Today's habits saved"), "ok"); load(); }
    catch (e) { toast(errMsg(e), "err"); } finally { setBusy(false); }
  };
  const logWeight = async () => {
    setBusy(true);
    try { const r = await api<{ official: boolean; planRefreshed: boolean }>("/weight", { body: { weight_kg: Number(w) } }); setW(""); toast(r.official ? tr("تم تسجيل وزن الأسبوع", "This week's weight logged") : tr("حُفظ كملاحظة (وزن الأسبوع الرسمي مسجّل بالفعل)", "Saved as a note (this week's official weight is already logged)"), "ok"); if (r.planRefreshed) toast(tr("تم تجديد خطتك الغذائية", "Your diet plan was refreshed"), "ok"); load(); }
    catch (e) { toast(errMsg(e), "err"); } finally { setBusy(false); }
  };
  const all = d.weights.map((x) => ({ date: x.logged_date, kg: Number(x.weight_kg), official: x.is_official }));
  const cutoff = new Date(`${d.today}T12:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate() - range);
  const pts = all.filter((p) => p.date >= cutoff.toISOString().slice(0, 10));
  const last = pts[pts.length - 1];
  const first = pts[0];
  const latest = all[all.length - 1];
  const start = all[0];
  const change = latest && start && all.length > 1 ? latest.kg - start.kg : null;
  const cheer = encouragement(d.goal ?? null, last && first && pts.length > 1 ? last.kg - first.kg : null, range, tr);

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-5">
      <PageHeader title={tr("تقدمي", "My progress")} />
      {/* Weight + streak side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card flex flex-col !p-3.5">
          <p className="text-sm font-bold text-ink-soft">{tr("وزنك", "Your weight")}</p>
          <p className="text-3xl font-extrabold tabular-nums">{latest ? latest.kg.toFixed(1) : "—"}<span className="text-base font-bold text-ink-soft"> {tr("كجم", "kg")}</span></p>
          <p className="text-xs font-bold text-ink-soft">{change === null ? (d.goal ? tr(`هدفك: ${goalLabel(d.goal, "ar")}`, `Goal: ${goalLabel(d.goal, "en")}`) : tr("سجّل وزنك لتبدأ", "Log your weight to start")) : tr(`${change > 0 ? "+" : ""}${change.toFixed(1)} كجم منذ البداية`, `${change > 0 ? "+" : ""}${change.toFixed(1)} kg since you started`)}</p>
          <a href="#weight" className="btn-primary btn-sm mt-auto !mt-3"><Icon name="scale" size={16} />{tr("سجّل وزنك", "Log weight")}</a>
        </div>
        <div className="card flex flex-col items-center !p-3.5 text-center">
          <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${d.streak.current > 0 ? "bg-sun-500 text-white" : "bg-canvas text-ink-soft"}`}><Icon name="flame" size={24} /></span>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-sun-600">{d.streak.current}</p>
          <p className="text-xs font-bold text-ink-soft">{tr("يوم متتالي", "day streak")} · {tr(`الأطول ${d.streak.longest}`, `best ${d.streak.longest}`)}</p>
          <MiniWeek today={d.today} done={d.weekDays ?? []} />
        </div>
      </div>

      <WeeklyCard today={d.today} weekDays={d.weekDays ?? []} streak={d.streak.current} total={d.streak.total} username={me?.profile.username ?? ""} />

      <section id="weight" className="card scroll-mt-24 space-y-3">
        <div className="flex items-center justify-between"><h2 className="h2">{tr("الوزن", "Weight")}</h2>{last && first && pts.length > 1 && <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-extrabold text-brand-800 tabular-nums">{last.kg - first.kg > 0 ? "+" : ""}{(last.kg - first.kg).toFixed(1)} kg</span>}</div>
        <WeightChart points={pts} />
        <div className="flex justify-center gap-1.5">{([[30, tr("٣٠ يوم", "30 days")], [90, tr("٣ شهور", "3 months")], [365, tr("سنة", "1 year")]] as const).map(([k, l]) => <button key={k} className="chip" aria-pressed={range === k} onClick={() => setRange(k)}>{l}</button>)}</div>
        {cheer && <p className={`rounded-xl px-3 py-2 text-center text-sm font-bold ${cheer.tone === "good" ? "bg-brand-50 text-brand-800" : "bg-sun-50 text-sun-600"}`}>{cheer.text}</p>}
        <div className="flex items-end gap-2"><div className="flex-1"><Field label={tr("وزنك اليوم (كجم)", "Your weight today (kg)")}><input className="field" type="number" inputMode="decimal" step="0.1" min={20} max={400} value={w} onChange={(e) => setW(e.target.value)} /></Field></div><button className="btn-primary" onClick={logWeight} disabled={busy || !(Number(w) >= 20)}>{busy ? <Spinner size={18} /> : <Icon name="plus" />}{tr("سجّل", "Log")}</button></div>
        <p className="muted">{tr("أول وزن في الأسبوع هو الوزن الرسمي الذي تعتمد عليه خطتك. باقي الأوزان تُحفظ كملاحظات.", "The first weight each week is the official one your plan uses. Extra entries are kept as notes.")}</p>
      </section>

      {d.calories && (
        <Link href="/diary" className="card flex items-center justify-between gap-3">
          <span><span className="block text-sm font-bold text-ink-soft">{tr("متوسط سعراتك اليومي (آخر ٧ أيام)", "Daily average calories (last 7 days)")}</span><span className="block text-3xl font-extrabold tabular-nums">{d.calories.avg7 ?? "—"}</span></span>
          <span className="text-end text-xs font-bold">{d.calories.avg7 === null ? <span className="text-ink-soft">{tr("سجّل أكلك لتظهر", "Log food to see it")}</span> : d.calories.target ? (Math.abs(d.calories.avg7 - d.calories.target) <= d.calories.target * 0.1 ? <span className="text-brand-700">{tr("ضمن هدفك", "On target")}</span> : <span className="text-sun-600">{d.calories.avg7 > d.calories.target ? tr(`أعلى من هدفك (${d.calories.target})`, `Above your goal (${d.calories.target})`) : tr(`أقل من هدفك (${d.calories.target})`, `Below your goal (${d.calories.target})`)}</span>) : null}<span className="block text-ink-soft">{tr(`${d.calories.daysLogged} أيام مسجّلة`, `${d.calories.daysLogged} days logged`)}</span></span>
        </Link>
      )}

      <section className="card space-y-4">
        <h2 className="h2">{tr("عادات اليوم", "Today's habits")}</h2>
        <div>
          <div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-2 font-extrabold"><Icon name="drop" className="text-sky-600" />{tr("المياه", "Water")}</span><span className="text-sm font-bold text-ink-soft tabular-nums">{cups} / {d.waterTarget} {tr("أكواب", "cups")}</span></div>
          <div className="h-3 overflow-hidden rounded-full bg-sky-50"><div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${Math.min(100, (cups / d.waterTarget) * 100)}%` }} /></div>
          <div className="mt-3 flex items-center justify-center gap-4"><button className="btn-soft !min-h-12 !w-12 !px-0" onClick={() => setCups(cups - 1)} aria-label={tr("كوب أقل", "One less")}><Icon name="minus" /></button><span className="w-10 text-center text-2xl font-extrabold tabular-nums">{cups}</span><button className="btn-primary !min-h-12 !w-12 !px-0" onClick={() => setCups(cups + 1)} aria-label={tr("كوب إضافي", "One more")}><Icon name="plus" /></button></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr("ساعات النوم", "Sleep hours")}><input className="field" type="number" inputMode="decimal" step="0.5" min={0} max={24} value={sleep} onChange={(e) => setSleep(e.target.value)} /></Field>
          <Field label={tr("الخطوات", "Steps")}><input className="field" type="number" inputMode="numeric" min={0} value={steps} onChange={(e) => setSteps(e.target.value)} /></Field>
        </div>
        <button className="btn-soft w-full" onClick={saveHabits} disabled={busy || (sleep === "" && steps === "")}><Icon name="check" />{tr("حفظ النوم والخطوات", "Save sleep and steps")}</button>
      </section>

      <section><h2 className="h2 mb-3">{tr("شاراتك", "Your badges")}</h2><BadgeGrid earned={d.badges} /></section>
    </div>
  );
}
export default function ProgressPage() { return <Gate><Inner /></Gate>; }
