"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Icon } from "./Icon";
import { useApp } from "./AppProvider";
import { Sheet, Spinner } from "./ui";

// The "+" shows on the everyday pages only (not on the AI page, which is itself an "add" screen, nor on payments/profile).
const PAGES = ["/today", "/diary", "/meals", "/plan", "/progress", "/community"];

/** Floating "+" with a one-tap quick-add sheet: snap a plate, log, repeat, water, weight, ask AI. Each option shows its cost. */
export function QuickAdd() {
  const { tr, toast, errMsg } = useApp();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!PAGES.some((p) => path === p || path.startsWith(p + "/"))) return null;

  const go = (href: string) => { setOpen(false); router.push(href); };
  const water = async () => {
    setBusy(true);
    try {
      const r = await api<{ water_cups: number | null }>("/habits", { body: { water_add: 1 } });
      toast(tr(`كوب مياه: ${r.water_cups ?? 1} اليوم`, `Water: ${r.water_cups ?? 1} cups today`), "ok");
      setOpen(false);
      window.dispatchEvent(new Event("healthy:refresh"));
    } catch (e) { toast(errMsg(e), "err"); } finally { setBusy(false); }
  };
  const items: { key: string; icon: string; ar: string; en: string; costAr: string; costEn: string; main?: boolean; run: () => void }[] = [
    { key: "scan", icon: "camera", ar: "صوّر طبقك", en: "Snap your plate", costAr: "١ كريدت", costEn: "1 credit", main: true, run: () => go("/chef?kind=scan") },
    { key: "log", icon: "utensils", ar: "سجّل وجبة", en: "Log a meal", costAr: "مجاني", costEn: "Free", run: () => go("/diary?add=meals") },
    { key: "repeat", icon: "refresh", ar: "كرر وجبة", en: "Repeat a meal", costAr: "من وجباتك", costEn: "From your meals", run: () => go("/diary?add=recent") },
    { key: "water", icon: "drop", ar: "كوب مياه", en: "Glass of water", costAr: "+١ بلمسة", costEn: "+1 in one tap", run: water },
    { key: "weight", icon: "scale", ar: "وزني اليوم", en: "Today's weight", costAr: "مجاني", costEn: "Free", run: () => go("/progress#weight") },
    { key: "ai", icon: "sparkles", ar: "اسأل AI", en: "Ask AI", costAr: "١ كريدت", costEn: "1 credit", run: () => go("/chef") },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] end-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-[0_8px_22px_rgb(5_150_105/0.45)] transition active:scale-90 lg:bottom-8 lg:end-8"
        aria-label={tr("إضافة سريعة", "Quick add")}
        aria-haspopup="dialog"
      >
        <Icon name="plus" size={28} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={tr("أضف بسرعة", "Quick add")}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {items.map((i) => (
            <button key={i.key} onClick={i.run} disabled={busy} className={`flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-3 text-center transition active:scale-95 ${i.main ? "border-brand-500 bg-brand-50" : "border-line bg-white"}`}>
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${i.main ? "bg-brand-600 text-white" : i.key === "water" ? "bg-sky-50 text-sky-600" : "bg-brand-50 text-brand-700"}`}>
                {busy && i.key === "water" ? <Spinner size={20} /> : <Icon name={i.icon} size={22} />}
              </span>
              <span className="text-sm font-extrabold leading-tight">{tr(i.ar, i.en)}</span>
              <span className="text-[11px] font-bold text-ink-soft">{tr(i.costAr, i.costEn)}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
