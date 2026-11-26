"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { useApp } from "./AppProvider";
import { addDays, weekStart } from "@/lib/dates";

/** Progress ring (SVG). `value/max` is clamped to 0..1; the track and colour follow the site palette. */
export function Ring({ value, max, size = 80, stroke = 9, color = "#059669", track = "#d1fae5", children, label }: { value: number; max: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role={label ? "img" : undefined} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {pct > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} className="transition-[stroke-dasharray] duration-700" />}
      </svg>
      {children && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
    </span>
  );
}

export const MACRO_COLORS = {
  protein: { color: "#e11d48", track: "#ffe4e6", text: "text-rose-600" },
  carbs: { color: "#f59e0b", track: "#fef3c7", text: "text-sun-600" },
  fat: { color: "#0284c7", track: "#e0f2fe", text: "text-sky-600" },
} as const;

type Totals = { calories: number; protein_g: number; carbs_g: number; fat_g: number };
type Targets = { protein: number; carbs: number; fat: number } | null;

/** Calories hero: big number, what's left, and a ring. Empty state invites the first log instead of showing zeros. */
export function CalorieCard({ totals, target, entries, onAdd }: { totals: Totals; target: number | null; entries: number; onAdd: () => void }) {
  const { tr } = useApp();
  if (entries === 0) {
    return (
      <button onClick={onAdd} className="card flex w-full items-center gap-4 text-start transition active:scale-[0.99]">
        <Ring value={0} max={1} size={76}><Icon name="camera" size={26} className="text-brand-600" /></Ring>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold">{tr("سجّل أول وجبة اليوم", "Log your first meal today")}</span>
          <span className="muted block">{target ? tr(`هدفك اليوم ${target} سعرة. صوّر طبقك أو اختره من القائمة.`, `Today's goal is ${target} kcal. Snap your plate or pick it from the list.`) : tr("صوّر طبقك أو اختره من القائمة.", "Snap your plate or pick it from the list.")}</span>
        </span>
        <Icon name="plus" size={22} className="text-brand-600" />
      </button>
    );
  }
  const over = target ? totals.calories > target : false;
  const left = target ? Math.abs(target - totals.calories) : 0;
  return (
    <Link href="/diary" className="card flex items-center justify-between gap-4">
      <span>
        <span className="block text-4xl font-extrabold leading-none tabular-nums">{totals.calories}{target ? <span className="text-lg font-bold text-ink-soft">/{target}</span> : null}</span>
        <span className="mt-1.5 block text-sm font-bold text-ink-soft">{!target ? tr("سعرة اليوم", "kcal today") : over ? tr(`سعرة · زيادة ${left} عن هدفك`, `kcal · ${left} over your goal`) : tr(`سعرة · باقي ${left}`, `kcal · ${left} left`)}</span>
      </span>
      <Ring value={totals.calories} max={target ?? totals.calories} size={84} stroke={10} color={over ? "#f59e0b" : "#059669"} label={tr("السعرات", "Calories")}>
        <Icon name="flame" size={26} className={over ? "text-sun-500" : "text-brand-600"} />
      </Ring>
    </Link>
  );
}

/** Protein / carbs / fat as three small rings. Only shown once something is logged. */
export function MacroRings({ totals, targets, estimated }: { totals: Totals; targets: Targets; estimated?: boolean }) {
  const { tr } = useApp();
  const items = [
    { k: "protein" as const, v: totals.protein_g, t: targets?.protein, ar: "بروتين", en: "Protein" },
    { k: "carbs" as const, v: totals.carbs_g, t: targets?.carbs, ar: "كربوهيدرات", en: "Carbs" },
    { k: "fat" as const, v: totals.fat_g, t: targets?.fat, ar: "دهون", en: "Fat" },
  ];
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((m) => (
          <div key={m.k} className="card flex flex-col items-center gap-1.5 !p-2.5 text-center">
            <p className="text-sm font-extrabold tabular-nums">{Math.round(m.v)}{m.t ? <span className="text-xs font-bold text-ink-soft">/{m.t}{tr("ج", "g")}</span> : <span className="text-xs font-bold text-ink-soft">{tr("ج", "g")}</span>}</p>
            <p className="text-xs font-bold text-ink-soft">{tr(m.ar, m.en)}</p>
            <Ring value={m.v} max={m.t ?? Math.max(1, m.v)} size={44} stroke={6} color={MACRO_COLORS[m.k].color} track={MACRO_COLORS[m.k].track} />
          </div>
        ))}
      </div>
      {estimated && <p className="mt-1.5 text-center text-[11px] font-bold text-ink-soft">{tr("الأرقام تقديرية للإرشاد العام.", "Estimates for general guidance.")}</p>}
    </div>
  );
}

/** Food tile (SVG, brand colours): a scan, a catalogue meal or a manual entry. Photos are never stored, so no thumbnails. */
export function FoodTile({ source, size = 48 }: { source: "meal" | "scan" | "manual"; size?: number }) {
  const map = { scan: { icon: "camera", cls: "from-brand-500 to-brand-700 text-white" }, meal: { icon: "utensils", cls: "from-sun-400 to-sun-600 text-white" }, manual: { icon: "edit", cls: "from-brand-50 to-brand-100 text-brand-700" } }[source];
  return <span className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${map.cls}`} style={{ width: size, height: size }} aria-hidden="true"><Icon name={map.icon} size={Math.round(size * 0.46)} /></span>;
}

/** Last 7 days: gold = a challenge done (streak day), green = only food logged, outline = today, dashed = missed. */
export function WeekStrip({ week, today, streak, frozen, freezeReady }: { week: { date: string; challenge: boolean; food: boolean }[]; today: string; streak: number; frozen?: boolean; freezeReady?: boolean }) {
  const { tr, lang } = useApp();
  const loc = lang === "ar" ? "ar-EG" : "en-GB";
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString(loc, { ...o, timeZone: "UTC" });
  // Arabic shows the Egyptian calendar week: Saturday on the right through Friday on the left, today highlighted, days still to come
  // dimmed. English keeps the last seven days ending today. The data always covers at least Saturday..today (Saturday is 0-6 days back).
  const days: { date: string; challenge: boolean; food: boolean; future?: boolean }[] = lang === "ar"
    ? Array.from({ length: 7 }, (_, i) => { const date = addDays(weekStart(today), i); return date > today ? { date, challenge: false, food: false, future: true } : week.find((w) => w.date === date) ?? { date, challenge: false, food: false }; })
    : week;
  return (
    <section className="card !p-3.5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-extrabold">
          <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${streak > 0 ? "bg-sun-500 text-white" : "bg-canvas text-ink-soft"}`}><Icon name="flame" size={18} /></span>
          <span className="tabular-nums">{streak}</span> {tr(streak === 1 ? "يوم متتالي" : "أيام متتالية", streak === 1 ? "day streak" : "day streak")}
        </p>
        {!frozen && freezeReady && streak >= 3 && <span className="flex items-center gap-1 text-xs font-bold text-brand-700"><Icon name="shieldCheck" size={15} />{tr("السلسلة محمية", "Streak protected")}</span>}
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const isToday = d.date === today;
          const tone = d.future ? "border-line/60 text-ink-soft/50" : d.challenge ? "border-sun-500 bg-sun-50 text-sun-600" : d.food ? "border-brand-500 bg-brand-50 text-brand-700" : isToday ? "border-ink/70 text-ink" : "border-dashed border-line text-ink-soft";
          return (
            <li key={d.date} className="flex flex-col items-center gap-1">
              <span className="text-[11px] font-bold text-ink-soft">{fmt(d.date, { weekday: "narrow" })}</span>
              <span className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-extrabold tabular-nums ${tone} ${isToday ? "ring-2 ring-ink/15 ring-offset-1" : ""}`} aria-label={`${fmt(d.date, { weekday: "long", day: "numeric" })}${d.challenge ? tr(": تحدٍّ منجز", ": challenge done") : d.food ? tr(": أكل مسجّل", ": food logged") : ""}`}>
                {d.challenge ? <Icon name="flame" size={16} /> : fmt(d.date, { day: "numeric" })}
              </span>
            </li>
          );
        })}
      </ol>
      {frozen && <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm font-bold text-brand-800">{tr("فاتك أمس، لكن سلسلتك محميّة. أنجز تحديًا اليوم لتكمل.", "You missed yesterday, but your streak is protected. Do a challenge today to keep it.")}</p>}
    </section>
  );
}
