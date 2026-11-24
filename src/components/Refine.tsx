"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { Spinner } from "./ui";
import type { CoachContent } from "./Domain";

export type SavedResult = { id: string; title: string; content: CoachContent; shared: boolean };

const RECIPE: { k: string; icon: string; ar: string; en: string }[] = [
  { k: "cheaper", icon: "wallet", ar: "أرخص", en: "Cheaper" },
  { k: "no_meat", icon: "leaf", ar: "من غير لحمة", en: "No meat" },
  { k: "lighter", icon: "scale", ar: "أقل سعرات", en: "Fewer calories" },
  { k: "protein", icon: "bolt", ar: "بروتين أكتر", en: "More protein" },
  { k: "quick", icon: "clock", ar: "أسرع", en: "Quicker" },
  { k: "swap", icon: "swap", ar: "بدّل مكوّن", en: "Swap an ingredient" },
];
const WORKOUT: { k: string; icon: string; ar: string; en: string }[] = [
  { k: "easier", icon: "leaf", ar: "أسهل", en: "Easier" },
  { k: "harder", icon: "flame", ar: "أصعب", en: "Harder" },
  { k: "shorter", icon: "clock", ar: "أقصر", en: "Shorter" },
];

/** One-tap changes to a saved result. Free (no credit); the original stays and the change opens as a new result. */
export function RefineBar({ id, kind, onResult }: { id: string; kind: "recipe" | "workout"; onResult: (r: SavedResult) => void }) {
  const { tr, lang, toast, errMsg } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [swap, setSwap] = useState(false);
  const [note, setNote] = useState("");
  const items = kind === "recipe" ? RECIPE : WORKOUT;

  const run = async (action: string, n?: string) => {
    setBusy(action);
    try {
      const r = await api<{ recipe: SavedResult }>(`/recipes/${id}/refine`, { body: { action, note: n, lang } });
      setSwap(false); setNote("");
      toast(tr("تم التعديل وحفظه كنسخة جديدة", "Changed and saved as a new copy"), "ok");
      onResult(r.recipe);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { toast(errMsg(e), "err"); } finally { setBusy(null); }
  };

  return (
    <section className="card space-y-3 !p-3.5" aria-busy={!!busy}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-extrabold"><Icon name="sparkles" size={18} className="text-brand-600" />{tr("عدّلها بلمسة", "Change it in one tap")}</p>
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-extrabold text-brand-700">{tr("مجاني", "Free")}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((x) => (
          <button key={x.k} className="chip" disabled={!!busy} aria-pressed={x.k === "swap" && swap} onClick={() => (x.k === "swap" ? setSwap(!swap) : run(x.k))}>
            {busy === x.k ? <Spinner size={15} /> : <Icon name={x.icon} size={15} />}{tr(x.ar, x.en)}
          </button>
        ))}
      </div>
      {swap && (
        <div className="flex gap-2">
          <input className="field !min-h-11" value={note} maxLength={40} onChange={(e) => setNote(e.target.value)} placeholder={tr("اسم المكوّن اللي عايز تبدله", "Ingredient to replace")} aria-label={tr("المكوّن", "Ingredient")} />
          <button className="btn-primary btn-sm" disabled={!!busy || note.trim().length < 2} onClick={() => run("swap", note.trim())}>{busy === "swap" ? <Spinner size={16} /> : <Icon name="check" size={18} />}{tr("بدّل", "Swap")}</button>
        </div>
      )}
      <p className="muted">{tr("بنحفظ التعديل كنسخة جديدة وتفضل الأصلية في مكتبتك. حد أقصى ٥ تعديلات للنتيجة في اليوم.", "The change is saved as a new copy; the original stays in your library. Up to 5 changes per result per day.")}</p>
    </section>
  );
}
