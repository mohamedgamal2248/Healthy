"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useGet } from "@/lib/useGet";
import { useApp } from "@/components/AppProvider";
import { EmptyState, Field, Gate, PageHeader, PageSkeleton, Sheet, Spinner } from "@/components/ui";
import { EatTabs } from "@/components/EatTabs";
import { Icon } from "@/components/Icon";
import { CalorieCard, FoodTile, MacroRings } from "@/components/Rings";
import type { MealRow } from "@/server/meals";

type Entry = { id: string; name: string; name_ar?: string; name_en?: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; source: "meal" | "scan" | "manual"; source_id?: string | null; estimated: boolean; auto?: boolean; servings?: number };
type Day = { date: string; entries: Entry[]; totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number }; target: number | null; targets: { protein: number; carbs: number; fat: number } | null; recent?: (Entry & { date: string })[] };
type Tab = "meals" | "recent" | "manual";

function AddSheet({ open, initialTab, recent, onClose, onAdded }: { open: boolean; initialTab: Tab; recent: (Entry & { date: string })[]; onClose: () => void; onAdded: (d: Day) => void }) {
  const { tr, lang, toast, errMsg } = useApp();
  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
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
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-brand-50 p-1.5">
          {([["meals", tr("القائمة", "Catalogue")], ["recent", tr("كرر", "Repeat")], ["manual", tr("يدويًا", "Manual")]] as const).map(([k, l]) => (
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
        ) : tab === "recent" ? (
          recent.length === 0 ? <p className="muted py-6 text-center">{tr("لا توجد وجبات سابقة بعد. سجّل وجبة وستظهر هنا.", "No earlier meals yet. Log one and it will show here.")}</p> : (
            <ul className="max-h-[50dvh] space-y-2 overflow-y-auto">
              {recent.map((m) => (
                <li key={m.id}>
                  <button className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line p-2.5 text-start hover:bg-brand-50" disabled={busy !== null} onClick={() => add(m.id, { source: "repeat", entryId: m.id })}>
                    <FoodTile source={m.source} size={40} />
                    <span className="min-w-0 flex-1"><span className="block truncate font-extrabold">{m.name}</span><span className="block text-xs font-bold text-ink-soft tabular-nums">{m.calories} {tr("سعرة", "kcal")} · {Math.round(m.protein_g)}{tr("ج بروتين", "g protein")}</span></span>
                    {busy === m.id ? <Spinner size={18} /> : <Icon name="refresh" size={18} className="text-brand-600" />}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="space-y-3">
            <Field label={tr("الاسم", "Name")}><input className="field" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={tr("السعرات", "Calories")}><input className="field" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value.replace(/\D/g, "").slice(0, 4))} /></Field>
              <Field label={tr("بروتين (جم)", "Protein (g)")}><input className="field" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value.replace(/[^0-9.]/g, "").slice(0, 5))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={tr("كربوهيدرات (جم) اختياري", "Carbs (g) optional")}><input className="field" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value.replace(/[^0-9.]/g, "").slice(0, 5))} /></Field>
              <Field label={tr("دهون (جم) اختياري", "Fat (g) optional")}><input className="field" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value.replace(/[^0-9.]/g, "").slice(0, 5))} /></Field>
            </div>
            <button className="btn-primary w-full" disabled={!manualOk || busy !== null} onClick={() => add("manual", { source: "manual", name: name.trim(), calories: kcalN, ...(protein ? { protein_g: Number(protein) } : {}), ...(carbs ? { carbs_g: Number(carbs) } : {}), ...(fat ? { fat_g: Number(fat) } : {}) })}>{busy === "manual" ? <Spinner /> : <Icon name="plus" />}{tr("أضف", "Add")}</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Inner() {
  const { tr, lang, toast, errMsg } = useApp();
  const { data: d, setData, reload } = useGet<Day>("/food", (e) => toast(errMsg(e), "err"));
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("meals");
  const [busy, setBusy] = useState<string | null>(null);
  // Opened from the floating "+": /diary?add=meals|recent|manual
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("add");
    if (q === "meals" || q === "recent" || q === "manual") { setTab(q); setOpen(true); history.replaceState(null, "", "/diary"); }
  }, []);
  if (!d) return <PageSkeleton />;
  const openAdd = (t: Tab) => { setTab(t); setOpen(true); };
  // Portion of an entry (the plan's meals can be made bigger or smaller): quarter steps from 0.5 to 3.
  const setPortion = async (id: string, servings: number) => {
    if (servings < 0.5 || servings > 3) return;
    setBusy(id);
    try { setData(await api<Day>("/food", { method: "PATCH", body: { id, servings } })); } catch (e) { toast(errMsg(e), "err"); reload(); } finally { setBusy(null); }
  };
  const remove = async (id: string) => {
    setBusy(id);
    try { setData(await api<Day>("/food", { method: "DELETE", body: { id } })); } catch (e) { toast(errMsg(e), "err"); reload(); } finally { setBusy(null); }
  };
  return (
    <div className="mx-auto max-w-3xl space-y-5 py-5">
      <EatTabs />
      <PageHeader title={tr("يومي", "My day")} sub={tr("سجّل ما أكلته وشوف قربك من هدفك.", "Log what you ate and see how close you are to your goal.")} />
      <CalorieCard totals={d.totals} target={d.target} entries={d.entries.length} onAdd={() => openAdd("meals")} />
      {d.entries.length > 0 && <MacroRings totals={d.totals} targets={d.targets} estimated />}
      {!d.target && <p className="muted">{tr("أكمل ملفك الصحي لتظهر لك سعراتك اليومية المستهدفة.", "Complete your health profile to see your daily calorie goal.")}</p>}
      <div className="grid grid-cols-2 gap-2.5">
        <button className="btn-primary" onClick={() => openAdd("meals")}><Icon name="plus" />{tr("أضف وجبة", "Add food")}</button>
        <button className="btn-soft" onClick={() => openAdd("recent")}><Icon name="refresh" size={18} />{tr("كرر وجبة", "Repeat a meal")}</button>
      </div>
      {d.entries.length === 0 ? (
        <EmptyState icon="utensils" title={tr("لم تسجّل شيئًا اليوم", "Nothing logged today")} body={tr("أضف من القائمة، أو من تحليل صورة، أو يدويًا.", "Add from the catalogue, from a photo analysis, or manually.")} />
      ) : (
        <ul className="space-y-2">
          {d.entries.map((e) => (
            <li key={e.id} className="card-row !min-h-16">
              {(() => {
                // Catalogue meals open the meal page; photo analyses and AI recipes open the saved result. Manual entries have no page.
                const href = e.source_id ? (e.source === "meal" ? `/meals/${e.source_id}` : e.source === "scan" ? `/chef?recipe=${e.source_id}` : null) : null;
                const inner = (
                  <>
                    <FoodTile source={e.source} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-extrabold">{(lang === "ar" ? e.name_ar : e.name_en) ?? e.name}{e.auto && <span className="ms-2 rounded-full bg-brand-50 px-2 py-0.5 align-middle text-[11px] font-bold text-brand-700">{tr("من خطتك", "From your plan")}</span>}</p>
                      <p className="text-xs font-bold text-ink-soft tabular-nums">{e.calories} {tr("سعرة", "kcal")} · {tr("ب", "P")} {Math.round(e.protein_g)} · {tr("ك", "C")} {Math.round(e.carbs_g)} · {tr("د", "F")} {Math.round(e.fat_g)}{e.estimated ? ` · ${tr("تقديري", "est.")}` : ""}</p>
                    </div>
                  </>
                );
                return href
                  ? <Link href={href} className="flex min-w-0 flex-1 items-center gap-3" aria-label={tr(`تفاصيل ${e.name}`, `Details of ${e.name}`)}>{inner}</Link>
                  : <div className="flex min-w-0 flex-1 items-center gap-3">{inner}</div>;
              })()}
              <span className="flex shrink-0 items-center" role="group" aria-label={tr("الحصة", "Portion")}>
                <button className="btn-ghost btn-sm !px-2" onClick={() => setPortion(e.id, (e.servings ?? 1) - 0.25)} disabled={busy === e.id || (e.servings ?? 1) <= 0.5} aria-label={tr("حصة أقل", "Smaller portion")}>-</button>
                <span className="min-w-9 text-center text-xs font-extrabold tabular-nums" dir="ltr">x{e.servings ?? 1}</span>
                <button className="btn-ghost btn-sm !px-2" onClick={() => setPortion(e.id, (e.servings ?? 1) + 0.25)} disabled={busy === e.id || (e.servings ?? 1) >= 3} aria-label={tr("حصة أكبر", "Larger portion")}>+</button>
              </span>
              <button className="btn-ghost btn-sm !px-2.5" onClick={() => remove(e.id)} disabled={busy === e.id} aria-label={tr(`حذف ${e.name}`, `Delete ${e.name}`)}>{busy === e.id ? <Spinner size={16} /> : <Icon name="trash" size={18} />}</button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs font-semibold text-ink-soft">{tr("أرقام تقديرية للإرشاد العام وليست نصيحة طبية.", "Estimates for general guidance, not medical advice.")}</p>
      <AddSheet open={open} initialTab={tab} recent={d.recent ?? []} onClose={() => setOpen(false)} onAdded={(x) => setData(x)} />
    </div>
  );
}
export default function DiaryPage() { return <Gate><Inner /></Gate>; }
