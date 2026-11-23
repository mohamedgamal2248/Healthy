"use client";
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
};

function Inner() {
  const { tr, toast, errMsg, me } = useApp();
  const { data: d, setData: setD, reload: load } = useGet<P>("/progress", (e) => toast(errMsg(e), "err"));
  const [w, setW] = useState("");
  const [sleep, setSleep] = useState("");
  const [steps, setSteps] = useState("");
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
  const pts = d.weights.map((x) => ({ date: x.logged_date, kg: Number(x.weight_kg), official: x.is_official }));
  const last = pts[pts.length - 1];
  const first = pts[0];

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-5">
      <PageHeader title={tr("تقدمي", "My progress")} />
      <div className="grid grid-cols-3 gap-3">
        {[["flame", tr("السلسلة", "Streak"), d.streak.current, "text-sun-500"], ["trophy", tr("أطول سلسلة", "Longest"), d.streak.longest, "text-brand-600"], ["check", tr("تحديات", "Done"), d.streak.total, "text-brand-600"]].map(([ic, l, v, c]) => (
          <div key={l as string} className="card text-center !p-3"><Icon name={ic as string} size={24} className={`mx-auto ${c}`} /><p className="text-2xl font-extrabold tabular-nums">{v as number}</p><p className="text-xs font-bold text-ink-soft">{l as string}</p></div>
        ))}
      </div>

      <WeeklyCard today={d.today} weekDays={d.weekDays ?? []} streak={d.streak.current} total={d.streak.total} username={me?.profile.username ?? ""} />

      <section className="card space-y-3">
        <div className="flex items-center justify-between"><h2 className="h2">{tr("الوزن", "Weight")}</h2>{last && first && pts.length > 1 && <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-extrabold text-brand-800 tabular-nums">{last.kg - first.kg > 0 ? "+" : ""}{(last.kg - first.kg).toFixed(1)} kg</span>}</div>
        <WeightChart points={pts} />
        <div className="flex items-end gap-2"><div className="flex-1"><Field label={tr("وزنك اليوم (كجم)", "Your weight today (kg)")}><input className="field" type="number" inputMode="decimal" step="0.1" min={20} max={400} value={w} onChange={(e) => setW(e.target.value)} /></Field></div><button className="btn-primary" onClick={logWeight} disabled={busy || !(Number(w) >= 20)}>{busy ? <Spinner size={18} /> : <Icon name="plus" />}{tr("سجّل", "Log")}</button></div>
        <p className="muted">{tr("أول وزن في الأسبوع هو الوزن الرسمي الذي تعتمد عليه خطتك. باقي الأوزان تُحفظ كملاحظات.", "The first weight each week is the official one your plan uses. Extra entries are kept as notes.")}</p>
      </section>

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
