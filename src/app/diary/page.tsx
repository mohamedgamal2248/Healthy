"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useGet } from "@/lib/useGet";
import { useApp } from "@/components/AppProvider";
import { EmptyState, Field, Gate, PageHeader, PageSkeleton, Sheet, Spinner } from "@/components/ui";
import { EatTabs } from "@/components/EatTabs";
import { Icon } from "@/components/Icon";
import type { MealRow } from "@/server/meals";

type Entry = { id: string; name: string; calories: number; protein_g: number; source: "meal" | "scan" | "manual" };
type Day = { date: string; entries: Entry[]; totals: { calories: number; protein_g: number }; target: number | null };

function AddSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (d: Day) => void }) {
  const { tr, lang, toast, errMsg } = useApp();
  const [tab, setTab] = useState<"meals" | "manual">("meals");
  const [q, setQ] = useState("");
  const [qd, setQd] = useState("");
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(() => setQd(q), 250); return () => clearTimeout(t); }, [q]);
  const { data } = useGet<{ meals: MealRow[] }>(open && tab === "meals" ? `/public/meals?${qd.trim() ? `q=${encodeURIComponent(qd.trim())}` : ""}` : null, undefined, { anon: true });
  const add = async (key: string, body: unknown) => {
    setBusy(key);
    try { onAdded(await api<Day>("/food", { body })); toast(tr("تمت الإضافة", "Added"), "ok"); onClose(); } catch (e) { toast(errMsg(e), "err"); } finally { setBusy(null); }
  };
  const kcalN = Number(kcal);
  const manualOk = name.trim().length > 0 && Number.isInteger(kcalN) && kcalN >= 0 && kcalN <= 5000;
  return (
    <Sheet open={open} onClose={onClose} title={tr("أضف إلى يومك", "Add to your day")}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-brand-50 p-1.5">
          {([["meals", tr("من الكتالوج", "From catalogue")], ["manual", tr("يدويًا", "Manual")]] as const).map(([k, l]) => (
            <button key={k} className={`min-h-11 rounded-xl text-sm font-extrabold ${tab === k ? "bg-white text-brand-800 shadow-sm" : "text-ink-soft"}`} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        {tab === "meals" ? (
          <>
            <div className="relative"><Icon name="search" size={18} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-ink-soft" /><input className="field !ps-11" placeholder={tr("ابحث عن وجبة…", "Search meals…")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr("بحث", "Search")} /></div>
            <ul className="max-h-[45dvh] space-y-2 overflow-y-auto">
              {(data?.meals ?? []).slice(0, 30).map((m) => (
                <li key={m.id}>
                  <button className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line p-3 text-start hover:bg-brand-50" disabled={busy !== null} onClick={() => add(m.id, { source: "meal", mealId: m.id })}>
                    <span className="min-w-0 flex-1 truncate font-extrabold">{lang === "ar" ? m.name_ar : m.name_en}</span>
                    <span className="text-sm font-bold tabular-nums text-ink-soft">{m.calories} {tr("سعرة", "kcal")}</span>
                    {busy === m.id ? <Spinner size={18} /> : <Icon name="plus" size={18} className="text-brand-600" />}
                  </button>
                </li>
              ))}
              {data && data.meals.length === 0 && <li className="muted py-4 text-center">{tr("لا نتائج.", "No results.")}</li>}
            </ul>
          </>
        ) : (
          <div className="space-y-3">
            <Field label={tr("الاسم", "Name")}><input className="field" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={tr("السعرات", "Calories")}><input className="field" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value.replace(/\D/g, "").slice(0, 4))} /></Field>
              <Field label={tr("بروتين (جم)", "Protein (g)")}><input className="field" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value.replace(/[^0-9.]/g, "").slice(0, 5))} /></Field>
            </div>
            <button className="btn-primary w-full" disabled={!manualOk || busy !== null} onClick={() => add("manual", { source: "manual", name: name.trim(), calories: kcalN, ...(protein ? { protein_g: Number(protein) } : {}) })}>{busy === "manual" ? <Spinner /> : <Icon name="plus" />}{tr("أضف", "Add")}</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Inner() {
  const { tr, toast, errMsg } = useApp();
  const { data: d, setData, reload } = useGet<Day>("/food", (e) => toast(errMsg(e), "err"));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  if (!d) return <PageSkeleton />;
  const eaten = d.totals.calories;
  const pct = d.target ? Math.min(100, Math.round((eaten / d.target) * 100)) : 0;
  const over = d.target ? eaten > d.target : false;
  const remove = async (id: string) => {
    setBusy(id);
    try { setData(await api<Day>("/food", { method: "DELETE", body: { id } })); } catch (e) { toast(errMsg(e), "err"); reload(); } finally { setBusy(null); }
  };
  return (
    <div className="mx-auto max-w-3xl space-y-5 py-5">
      <EatTabs />
      <PageHeader title={tr("يومي", "My day")} sub={tr("سجّل ما أكلته وشوف قربك من هدفك.", "Log what you ate and see how close you are to your goal.")} />
      <section className="card space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-sm font-bold text-ink-soft">{tr("السعرات اليوم", "Calories today")}</p><p className="text-4xl font-extrabold tabular-nums">{eaten}{d.target ? <span className="text-lg font-bold text-ink-soft"> / {d.target}</span> : null}</p></div>
          <div className="text-end"><p className="text-sm font-bold text-ink-soft">{tr("بروتين", "Protein")}</p><p className="text-2xl font-extrabold tabular-nums">{d.totals.protein_g}<span className="text-base"> g</span></p></div>
        </div>
        {d.target ? (
          <>
            <div className="h-3 overflow-hidden rounded-full bg-brand-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className={`h-full rounded-full ${over ? "bg-sun-500" : "bg-brand-600"}`} style={{ width: `${pct}%` }} /></div>
            <p className="muted">{over ? tr(`تجاوزت هدفك بـ ${eaten - d.target} سعرة. لا بأس، ابدأ من جديد غدًا.`, `You are ${eaten - d.target} kcal over today's goal. No problem, start fresh tomorrow.`) : tr(`باقي ${d.target - eaten} سعرة لهدف اليوم.`, `${d.target - eaten} kcal left for today's goal.`)}</p>
          </>
        ) : <p className="muted">{tr("أكمل ملفك الصحي لتظهر لك سعراتك اليومية المستهدفة.", "Complete your health profile to see your daily calorie goal.")}</p>}
        <p className="text-xs font-semibold text-ink-soft">{tr("أرقام تقديرية للإرشاد العام وليست نصيحة طبية.", "Estimates for general guidance, not medical advice.")}</p>
      </section>
      <button className="btn-primary w-full" onClick={() => setOpen(true)}><Icon name="plus" />{tr("أضف وجبة", "Add food")}</button>
      {d.entries.length === 0 ? (
        <EmptyState icon="utensils" title={tr("لم تسجّل شيئًا اليوم", "Nothing logged today")} body={tr("أضف من الكتالوج، أو من تحليل صورة، أو يدويًا.", "Add from the catalogue, from a photo analysis, or manually.")} />
      ) : (
        <ul className="space-y-2.5">
          {d.entries.map((e) => (
            <li key={e.id} className="card flex items-center gap-3 !p-3.5">
              <div className="min-w-0 flex-1"><p className="truncate font-extrabold">{e.name}</p><p className="muted">{e.calories} {tr("سعرة", "kcal")} · {e.protein_g} g {tr("بروتين", "protein")}</p></div>
              <button className="btn-ghost btn-sm !px-2.5" onClick={() => remove(e.id)} disabled={busy === e.id} aria-label={tr("حذف", "Delete")}>{busy === e.id ? <Spinner size={16} /> : <Icon name="trash" size={18} />}</button>
            </li>
          ))}
        </ul>
      )}
      <AddSheet open={open} onClose={() => setOpen(false)} onAdded={(x) => setData(x)} />
    </div>
  );
}
export default function DiaryPage() { return <Gate><Inner /></Gate>; }
