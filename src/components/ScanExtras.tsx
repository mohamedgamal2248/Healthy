"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { Spinner } from "./ui";
import { MACRO_COLORS } from "./Rings";

export type ScanHints = { cook: string | null; size: string | null; extras: string[] };
const COOK = [["boiled", "مسلوق", "Boiled"], ["oil", "بالزيت", "With oil"], ["fried", "مقلي", "Fried"], ["grilled", "مشوي", "Grilled"]] as const;
const SIZE = [["half", "نص طبق", "Half plate"], ["plate", "طبق", "One plate"], ["large", "طبق كبير", "Large plate"]] as const;
const EXTRAS = [["oil", "زيت", "Oil"], ["ghee", "سمنة", "Ghee/butter"], ["sauce", "صوص", "Sauce"], ["sugar", "سكر", "Sugar"]] as const;

/** Turn the optional answers into a short note for the model (English keeps it compact; the model answers in the UI language). */
export function hintsToNote(h: ScanHints): string {
  const parts: string[] = [];
  const cook = COOK.find((c) => c[0] === h.cook); if (cook) parts.push(`Cooking: ${cook[2]}.`);
  const size = SIZE.find((c) => c[0] === h.size); if (size) parts.push(`Portion: ${size[2]}.`);
  const ex = EXTRAS.filter((c) => h.extras.includes(c[0])).map((c) => c[2]); if (ex.length) parts.push(`Hidden extras: ${ex.join(", ")}.`);
  return parts.join(" ");
}

/** Optional quick questions before a photo analysis: they make the estimate more accurate at no extra cost. */
export function ScanQuestions({ value, onChange }: { value: ScanHints; onChange: (h: ScanHints) => void }) {
  const { tr } = useApp();
  const Row = ({ label, opts, on, pick }: { label: string; opts: readonly (readonly [string, string, string])[]; on: (k: string) => boolean; pick: (k: string) => void }) => (
    <div>
      <p className="mb-1.5 text-sm font-bold text-ink-soft">{label}</p>
      <div className="flex flex-wrap gap-1.5">{opts.map(([k, ar, en]) => <button key={k} type="button" className="chip" aria-pressed={on(k)} onClick={() => pick(k)}>{tr(ar, en)}</button>)}</div>
    </div>
  );
  return (
    <div className="space-y-3 rounded-2xl border border-line p-3.5">
      <p className="font-extrabold">{tr("أسئلة سريعة تحسّن الدقة", "Quick questions for a better estimate")} <span className="text-xs font-bold text-ink-soft">({tr("اختياري", "optional")})</span></p>
      <Row label={tr("طريقة الطهي", "Cooking")} opts={COOK} on={(k) => value.cook === k} pick={(k) => onChange({ ...value, cook: value.cook === k ? null : k })} />
      <Row label={tr("الكمية", "Amount")} opts={SIZE} on={(k) => value.size === k} pick={(k) => onChange({ ...value, size: value.size === k ? null : k })} />
      <Row label={tr("إضافات ممكن ما تبانش", "Extras that may not show")} opts={EXTRAS} on={(k) => value.extras.includes(k)} pick={(k) => onChange({ ...value, extras: value.extras.includes(k) ? value.extras.filter((x) => x !== k) : [...value.extras, k] })} />
    </div>
  );
}

type Ing = { name: string; grams: number; kcal: number };
type Totals = { calories: { mid: number }; protein_g: { mid: number }; carbs_g: number; fat_g: number };
const STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const fmtPortion = (p: number, ar: boolean) => (ar ? p.toLocaleString("ar-EG") : String(p));

/**
 * Adjust a photo result before adding it: portion stepper and "fix result" (untick ingredients that aren't there).
 * The preview here is for display; the server recomputes the logged numbers from the stored analysis.
 */
export function ScanAdjust({ recipeId, name, totals, ingredients, onAdded }: { recipeId: string; name: string; totals: Totals; ingredients: Ing[]; onAdded: () => void }) {
  const { tr, lang, toast, errMsg } = useApp();
  const [portion, setPortion] = useState(1);
  const [fixing, setFixing] = useState(false);
  const [exclude, setExclude] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const all = ingredients.reduce((n, i) => n + Math.max(0, i.kcal), 0);
  const removed = ingredients.reduce((n, i, k) => n + (exclude.includes(k) ? Math.max(0, i.kcal) : 0), 0);
  const f = (all > 0 ? (all - removed) / all : 1) * portion;
  const v = { kcal: Math.round(totals.calories.mid * f), p: Math.round(totals.protein_g.mid * f), c: Math.round(totals.carbs_g * f), fat: Math.round(totals.fat_g * f) };
  const step = (dir: 1 | -1) => { const i = STEPS.indexOf(portion); const n = STEPS[Math.max(0, Math.min(STEPS.length - 1, i + dir))]; setPortion(n); };
  const add = async () => {
    setBusy(true);
    try { await api("/food", { body: { source: "recipe", recipeId, portion, exclude } }); toast(tr("تمت الإضافة إلى يومك", "Added to your day"), "ok"); onAdded(); }
    catch (e) { toast(errMsg(e), "err"); } finally { setBusy(false); }
  };
  return (
    <section className="card space-y-3.5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 flex-1 text-lg font-extrabold leading-snug">{name}</h2>
        <div className="flex items-center rounded-full border border-line" role="group" aria-label={tr("الكمية", "Portion")}>
          <button className="flex h-10 w-10 items-center justify-center text-brand-700 disabled:opacity-40" onClick={() => step(-1)} disabled={portion <= STEPS[0]} aria-label={tr("أقل", "Less")}><Icon name="minus" size={18} /></button>
          <span className="min-w-10 text-center font-extrabold tabular-nums">{fmtPortion(portion, lang === "ar")}×</span>
          <button className="flex h-10 w-10 items-center justify-center text-brand-700 disabled:opacity-40" onClick={() => step(1)} disabled={portion >= STEPS[STEPS.length - 1]} aria-label={tr("أكثر", "More")}><Icon name="plus" size={18} /></button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sun-50 text-sun-500"><Icon name="flame" size={26} /></span>
        <div><p className="text-3xl font-extrabold leading-none tabular-nums">{v.kcal}</p><p className="text-xs font-bold text-ink-soft">{tr("سعرة تقريبًا", "kcal, approx.")}</p></div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {([["protein", v.p, "بروتين", "Protein"], ["carbs", v.c, "كربوهيدرات", "Carbs"], ["fat", v.fat, "دهون", "Fat"]] as const).map(([k, n, ar, en]) => (
          <div key={k} className="rounded-xl border border-line p-2"><p className={`text-lg font-extrabold tabular-nums ${MACRO_COLORS[k].text}`}>{n}{tr("ج", "g")}</p><p className="text-xs font-bold text-ink-soft">{tr(ar, en)}</p></div>
        ))}
      </div>
      {fixing && (
        <ul className="space-y-1.5">
          {ingredients.map((i, k) => {
            const off = exclude.includes(k);
            return (
              <li key={k}>
                <button className={`flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-start text-sm font-bold ${off ? "border-line bg-canvas text-ink-soft line-through" : "border-brand-200 bg-brand-50/50"}`} aria-pressed={!off} onClick={() => setExclude(off ? exclude.filter((x) => x !== k) : exclude.length + 1 >= ingredients.length ? exclude : [...exclude, k])}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-md border-2 ${off ? "border-line" : "border-brand-600 bg-brand-600 text-white"}`}>{!off && <Icon name="check" size={13} />}</span>
                  <span className="min-w-0 flex-1 truncate">{i.name}</span>
                  <span className="tabular-nums">{Math.round(i.kcal)} {tr("سعرة", "kcal")}</span>
                </button>
              </li>
            );
          })}
          <li className="px-1 text-xs font-bold text-ink-soft">{tr("شيل أي مكوّن مش موجود في طبقك، والأرقام تتعدل.", "Untick anything that isn't on your plate; the numbers update.")}</li>
        </ul>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-soft" onClick={() => setFixing(!fixing)} aria-expanded={fixing}><Icon name="edit" size={18} />{fixing ? tr("تم التصحيح", "Done fixing") : tr("صحّح النتيجة", "Fix result")}</button>
        <button className="btn-primary" onClick={add} disabled={busy}>{busy ? <Spinner size={18} /> : <Icon name="plus" size={18} />}{tr("أضف ليومي", "Add to my day")}</button>
      </div>
    </section>
  );
}
