"use client";
import { Icon } from "./Icon";
import { useApp } from "./AppProvider";
import { BADGES } from "@/data/badges";

const TYPE_ICON: Record<string, string> = {
  water: "drop", steps: "steps", walk: "steps", sleep: "moon", no_sugar: "shield", no_soda: "shield", vegetables: "leaf", fruit: "carrot",
  no_late_food: "clock", custom: "sparkles", no_fried: "flame", stretch: "sparkles", mindful: "heart", protein: "utensils",
};
const TYPE_TONE: Record<string, string> = { water: "bg-sky-50 text-sky-600", sleep: "bg-indigo-50 text-indigo-600", steps: "bg-brand-50 text-brand-600", walk: "bg-brand-50 text-brand-600" };

export type ChallengeItem = { id: string; status: "assigned" | "completed"; type: string; title_ar: string; title_en: string };

export function ChallengeCard({ c, onDone, onSwap, canSwap, busy }: { c: ChallengeItem; onDone: (id: string) => void; onSwap?: (id: string) => void; canSwap?: boolean; busy?: boolean }) {
  const { tr, lang } = useApp();
  const done = c.status === "completed";
  return (
    <div className={`card-row !min-h-16 ${done ? "!border-brand-200 !bg-brand-50/70" : ""}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${done ? "bg-brand-100 text-brand-700" : TYPE_TONE[c.type] ?? "bg-sun-50 text-sun-600"}`}>
        <Icon name={TYPE_ICON[c.type] ?? "star"} size={24} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-extrabold leading-snug ${done ? "text-brand-800" : ""}`}>{lang === "ar" ? c.title_ar : c.title_en}</p>
        {done && <p className="text-xs font-bold text-brand-700">{tr("أحسنت! تم الإنجاز", "Done, well done!")}</p>}
      </div>
      {!done && canSwap && onSwap && c.type !== "custom" && (
        <button className="btn-ghost btn-sm !px-2.5" onClick={() => onSwap(c.id)} disabled={busy} aria-label={tr("تبديل التحدي", "Swap challenge")} title={tr("تبديل التحدي (مرة واحدة يوميًا)", "Swap (once a day)")}>
          <Icon name="swap" size={20} />
        </button>
      )}
      <button
        onClick={() => !done && onDone(c.id)}
        disabled={done || busy}
        aria-label={done ? tr("منجز", "Completed") : tr("تم", "Mark done")}
        aria-pressed={done}
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${done ? "pop border-brand-600 bg-brand-600 text-white" : "border-brand-300 bg-white text-brand-600 hover:bg-brand-50"}`}
      >
        <Icon name="check" size={26} />
      </button>
    </div>
  );
}

export function StreakHeader({ current, longest, total, doneToday, frozen = false, freezeReady = false }: { current: number; longest: number; total: number; doneToday: number; frozen?: boolean; freezeReady?: boolean }) {
  const { tr } = useApp();
  const alive = doneToday > 0;
  return (
    <section className="overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-5 text-white shadow-(--shadow-card)">
      <div className="flex items-center gap-4">
        <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl ${alive ? "bg-sun-400 text-white" : "bg-white/15 text-white/80"}`}>
          <Icon name="flame" size={34} filled={alive} />
        </span>
        <div>
          <p className="text-sm font-bold text-brand-100">{tr("السلسلة الحالية", "Current streak")}</p>
          <p className="text-4xl font-extrabold leading-none tabular-nums">{current} <span className="text-lg font-bold">{tr(current === 1 ? "يوم" : "أيام", current === 1 ? "day" : "days")}</span></p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/12 p-3"><p className="text-xs font-bold text-brand-100">{tr("أطول سلسلة", "Longest streak")}</p><p className="text-xl font-extrabold tabular-nums">{longest}</p></div>
        <div className="rounded-2xl bg-white/12 p-3"><p className="text-xs font-bold text-brand-100">{tr("إجمالي التحديات", "Total completed")}</p><p className="text-xl font-extrabold tabular-nums">{total}</p></div>
      </div>
          {frozen && <p className="mt-3 rounded-2xl bg-white/15 px-3 py-2 text-sm font-bold">{tr("فاتك أمس، لكن سلسلتك محميّة. أنجز تحديًا اليوم لتكمل.", "You missed yesterday, but your streak is protected. Do a challenge today to keep it.")}</p>}
      {!frozen && freezeReady && current >= 3 && <p className="mt-3 text-xs font-bold text-brand-100">{tr("حماية السلسلة جاهزة: يومٌ فائت واحد يُغفر تلقائيًا.", "Streak protection is ready: one missed day is forgiven automatically.")}</p>}
    </section>
  );
}

export function BadgeGrid({ earned }: { earned: { badge_key: string }[] }) {
  const { tr, lang } = useApp();
  const have = new Set(earned.map((b) => b.badge_key));
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {BADGES.map((b) => {
        const on = have.has(b.key);
        return (
          <div key={b.key} className={`rounded-2xl border p-3 text-center ${on ? "border-sun-100 bg-sun-50" : "border-line bg-white opacity-70"}`}>
            <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${on ? "bg-sun-400 text-white" : "bg-canvas text-ink-soft"}`}>
              <Icon name={on ? b.icon : "lock"} size={24} />
            </span>
            <p className="mt-2 text-sm font-extrabold">{lang === "ar" ? b.ar : b.en}</p>
            <p className="text-xs text-ink-soft">{lang === "ar" ? b.desc_ar : b.desc_en}</p>
            {!on && <p className="sr-only">{tr("لم يُكتسب بعد", "Not earned yet")}</p>}
          </div>
        );
      })}
    </div>
  );
}
