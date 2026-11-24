"use client";
import { inPiContext } from "@/lib/pi-client";
import { piBrowserUrl } from "@/lib/pi-handoff";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { Icon } from "./Icon";
import { useApp, type Balances } from "./AppProvider";
import { Notice, Sheet, Spinner } from "./ui";
import { DISCLAIMER_AR, DISCLAIMER_EN } from "@/lib/texts";
import { payWithPi } from "@/lib/pi-client";
import { usdLabel } from "@/lib/money";

export function DisclaimerBanner({ conditions = [], compact }: { conditions?: string[]; compact?: boolean }) {
  const { tr } = useApp();
  const medical = conditions.some((c) => ["diabetes", "hypertension", "pregnancy"].includes(c));
  return (
    <div className="space-y-2">
      <Notice tone="info" icon="info">
        <span className={compact ? "text-xs" : ""}>{tr(DISCLAIMER_AR, DISCLAIMER_EN)}</span>
      </Notice>
      {medical && (
        <Notice tone="warn">{tr("لأنك أعلنت حالة صحية (سكري أو ضغط أو حمل): راجع طبيبك المعالج قبل اتباع أي خطة أو وصفة.", "Because you declared a health condition (diabetes, hypertension or pregnancy): review any plan or recipe with your treating doctor before following it.")}</Notice>
      )}
    </div>
  );
}

export function CreditBalance({ b, className = "" }: { b: Balances | null; className?: string }) {
  const { tr } = useApp();
  if (!b) return null;
  const date = b.planExpiresAt ? new Date(b.planExpiresAt).toLocaleDateString(tr("ar-EG", "en-GB"), { day: "numeric", month: "long", year: "numeric" }) : null;
  const R = 34, C = 2 * Math.PI * R;
  const full = Math.max(10, b.total);
  const parts = [
    { label: tr("من الخطة", "Plan"), v: b.plan, color: "#10b981" },
    { label: tr("من الباقات", "Packs"), v: b.pack, color: "#f59e0b" },
    { label: tr("مكافآت", "Rewards"), v: b.trial, color: "#8b5cf6" },
  ];
  let offset = 0;
  return (
    <div className={`rounded-3xl border border-sun-100 bg-gradient-to-br from-sun-50 via-white to-brand-50 p-4 shadow-(--shadow-card) ${className}`}>
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0" role="img" aria-label={tr(`${b.total} طلب AI متاح`, `${b.total} AI requests available`)}>
          <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
            <circle cx="40" cy="40" r={R} fill="none" stroke="#fde68a" strokeOpacity=".45" strokeWidth="9" />
            {b.total > 0 && parts.filter((p) => p.v > 0).map((p) => {
              const len = (p.v / full) * C;
              const el = <circle key={p.label} cx="40" cy="40" r={R} fill="none" stroke={p.color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${Math.max(len - 3, 0.1)} ${C}`} strokeDashoffset={-offset} />;
              offset += len;
              return el;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-extrabold leading-none tabular-nums text-ink">{b.total}</span>
            <span className="mt-0.5 text-[10px] font-extrabold text-ink-soft">{tr("طلب AI", "AI requests")}</span>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {parts.map((p) => (
            <li key={p.label} className="flex items-center gap-2 text-sm font-bold">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} />
              <span className="flex-1 text-ink-soft">{p.label}</span>
              <span className="tabular-nums text-ink">{p.v}</span>
            </li>
          ))}
          <li className="pt-1"><Link href="/pricing" className="inline-flex items-center gap-1 text-xs font-extrabold text-brand-700"><Icon name="plus" size={14} />{tr("اشحن طلبات", "Get more requests")}</Link></li>
        </ul>
      </div>
      <p className="mt-3 text-xs font-semibold text-ink-soft">
        {b.planActive && date
          ? tr(`طلبات الخطة تنتهي مع الخطة في ${date}، وطلبات الباقات لا تنتهي.`, `Plan requests expire with the plan on ${date}; pack requests never expire.`)
          : tr("طلبات الباقات لا تنتهي، وطلبات الخطة الشهرية تنتهي بانتهائها.", "Pack requests never expire; monthly-plan requests expire with the plan.")}
      </p>
    </div>
  );
}

export type RecipeContent = {
  recipe: { name: string; ingredients: { item: string; quantity: string }[]; steps: string[]; calories: number; protein: number; benefits: { ingredient: string; benefit: string }[]; substitutions: { missing: string; use: string }[]; suitable_for: string[] };
  cautions: { ar: string; en: string }[];
  doctor_note: { ar: string; en: string } | null;
};

export type ScanResult = {
  dish_name: string; dish_name_local?: string; confidence: "low" | "medium" | "high"; setting: string; portion: string; estimated_total_g: number;
  ingredients: { name: string; grams: number; kcal: number; certainty: "seen" | "likely"; alternatives?: { name: string; kcal_per_100g: number }[] }[];
  totals: { calories: { low: number; mid: number; high: number }; protein_g: { low: number; mid: number; high: number }; carbs_g: number; fat_g: number };
  notes: string[]; assumptions: string[];
};

export type FridgeIdea = { name: string; minutes?: number; ingredients: { item: string; quantity: string }[]; missing: string[]; steps: string[]; calories: number; protein: number };

export type CoachContent = Omit<RecipeContent, "recipe"> & {
  scan?: ScanResult;
  kind?: "recipe" | "workout" | "challenge" | "scan" | "fridge";
  recipe?: RecipeContent["recipe"];
  fridge?: { seen: string[]; ideas: FridgeIdea[] };
  card?: { name: string; summary: string; level?: string; duration_min?: number; sections: { heading: string; items: string[] }[]; tips: string[] };
};

/** Picks the right view for AI result (recipe, workout or challenge). */
export function ContentView({ content, actions }: { content: CoachContent; actions?: ReactNode }) {
  if (content.kind === "scan" && content.scan) return <ScanView content={content} actions={actions} />;
  if (content.kind === "fridge" && content.fridge) return <FridgeView content={content} actions={actions} />;
  if (content.kind && content.kind !== "recipe" && content.card) return <CardView content={content} actions={actions} />;
  return <RecipeView content={content as RecipeContent} actions={actions} />;
}

/** "From my fridge": what the AI understood, then 3 meal ideas the user can open and log with one tap (numbers are estimates). */
export function FridgeView({ content, actions }: { content: CoachContent; actions?: ReactNode }) {
  const { tr, toast, errMsg } = useApp();
  const f = content.fridge!;
  const [open, setOpen] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);
  const add = async (i: number) => {
    const x = f.ideas[i];
    setBusy(i);
    try {
      await api("/food", { body: { source: "manual", name: x.name.slice(0, 120), calories: Math.round(x.calories), protein_g: Math.round(x.protein) } });
      toast(tr("تمت الإضافة إلى يومك", "Added to your day"), "ok");
      window.dispatchEvent(new Event("healthy:refresh"));
    } catch (e) { toast(errMsg(e), "err"); } finally { setBusy(null); }
  };
  return (
    <article className="card space-y-4">
      <header>
        <p className="text-xs font-extrabold text-brand-600">{tr("أفكار من اللي عندك", "Ideas from what you have")}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">{f.seen.map((s) => <span key={s} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-800">{s}</span>)}</div>
      </header>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      <ul className="space-y-3">
        {f.ideas.map((x, i) => {
          const on = open === i;
          return (
            <li key={i} className={`rounded-2xl border-2 ${on ? "border-brand-500" : "border-line"}`}>
              <button className="flex w-full items-center gap-3 p-3.5 text-start" onClick={() => setOpen(on ? -1 : i)} aria-expanded={on}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 font-extrabold text-white">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-extrabold leading-snug">{x.name}</span>
                  <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs font-bold text-ink-soft"><span>{Math.round(x.calories)} {tr("سعرة", "kcal")}</span><span>{Math.round(x.protein)} {tr("جم بروتين", "g protein")}</span>{x.minutes ? <span>{x.minutes} {tr("د", "min")}</span> : null}</span>
                </span>
                <Icon name={on ? "minus" : "plus"} size={20} className="text-brand-600" />
              </button>
              {on && (
                <div className="space-y-3 border-t border-line p-3.5">
                  <ul className="divide-y divide-line rounded-xl border border-line">{x.ingredients.map((g, k) => <li key={k} className="flex items-center justify-between gap-3 px-3 py-2"><span className="font-bold">{g.item}</span><span className="text-sm text-ink-soft">{g.quantity}</span></li>)}</ul>
                  {x.missing.length > 0 && <p className="rounded-xl bg-sun-50 p-2.5 text-sm font-bold text-sun-600">{tr("ناقص بسيط: ", "Small missing items: ")}{x.missing.join(tr("، ", ", "))}</p>}
                  <ol className="space-y-2">{x.steps.map((s, k) => <li key={k} className="flex gap-2.5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-800">{k + 1}</span><span className="pt-0.5 text-sm">{s}</span></li>)}</ol>
                  <button className="btn-primary w-full" onClick={() => add(i)} disabled={busy !== null}>{busy === i ? <Spinner size={18} /> : <Icon name="plus" size={18} />}{tr("أضف ليومي", "Add to my day")}</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Notice tone="info">{tr("الأرقام تقديرية للإرشاد العام وتتغير بالمقادير والزيت.", "Numbers are estimates for general guidance and change with amounts and oil.")}</Notice>
      {content.cautions.map((x, k) => (<Notice key={k} tone="warn">{tr(x.ar, x.en)}</Notice>))}
      {content.doctor_note && <Notice tone="warn" icon="shieldCheck">{tr(content.doctor_note.ar, content.doctor_note.en)}</Notice>}
      <footer className="border-t border-line pt-3 text-xs font-semibold text-ink-soft">{tr(DISCLAIMER_AR, DISCLAIMER_EN)}</footer>
    </article>
  );
}

export function ScanView({ content, actions }: { content: CoachContent; actions?: ReactNode }) {
  const { tr, lang } = useApp();
  const s = content.scan!;
  const conf = { low: tr("ثقة منخفضة", "Low confidence"), medium: tr("ثقة متوسطة", "Medium confidence"), high: tr("ثقة عالية", "High confidence") }[s.confidence];
  const confTone = s.confidence === "high" ? "bg-brand-100 text-brand-800" : s.confidence === "medium" ? "bg-sun-100 text-sun-600" : "bg-rose-100 text-rose-600";
  const setting = ({ home: tr("أكل بيت", "Home-cooked"), restaurant: tr("مطعم", "Restaurant"), street: tr("أكل شارع", "Street food"), packaged: tr("معبأ", "Packaged"), unknown: tr("غير محدد", "Unknown") } as Record<string, string>)[s.setting] ?? s.setting;
  const c = s.totals.calories, p = s.totals.protein_g;
  return (
    <article className="card space-y-5">
      <header>
        <p className="text-xs font-extrabold text-brand-600">{tr("تحليل وجبة بالصورة (تقدير)", "Meal photo analysis (estimate)")}</p>
        <h2 className="text-xl font-extrabold leading-snug">{lang === "ar" && s.dish_name_local ? s.dish_name_local : s.dish_name}</h2>
        {lang === "en" && s.dish_name_local ? <p className="muted" dir="auto">{s.dish_name_local}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${confTone}`}>{conf}</span>
          <span className="chip !cursor-default">{setting}</span>
          <span className="chip !cursor-default">~{Math.round(s.estimated_total_g)} g</span>
        </div>
      </header>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-sun-50 p-3 text-center">
          <Icon name="flame" size={20} className="mx-auto text-sun-500" />
          <p className="text-3xl font-extrabold tabular-nums">{Math.round(c.mid)}</p>
          <p className="text-xs font-bold text-ink-soft">{tr("سعرة (تقدير)", "kcal (estimate)")}</p>
          <p className="mt-1 text-xs font-bold text-sun-600 tabular-nums">{Math.round(c.low)} – {Math.round(c.high)}</p>
        </div>
        <div className="rounded-2xl bg-brand-50 p-3 text-center">
          <Icon name="bolt" size={20} className="mx-auto text-brand-600" />
          <p className="text-3xl font-extrabold tabular-nums">{Math.round(p.mid)}<span className="text-base"> g</span></p>
          <p className="text-xs font-bold text-ink-soft">{tr("بروتين (تقدير)", "protein (estimate)")}</p>
          <p className="mt-1 text-xs font-bold text-brand-700 tabular-nums">{Math.round(p.low)} – {Math.round(p.high)} g</p>
        </div>
        <div className="rounded-2xl bg-sky-50 p-3 text-center"><p className="text-xl font-extrabold tabular-nums">{Math.round(s.totals.carbs_g)} g</p><p className="text-xs font-bold text-ink-soft">{tr("كربوهيدرات", "Carbs")}</p></div>
        <div className="rounded-2xl bg-rose-50 p-3 text-center"><p className="text-xl font-extrabold tabular-nums">{Math.round(s.totals.fat_g)} g</p><p className="text-xs font-bold text-ink-soft">{tr("دهون", "Fat")}</p></div>
      </section>
      <section>
        <h3 className="h2 mb-2">{tr("المكونات المقدّرة", "Estimated ingredients")}</h3>
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {s.ingredients.map((i, k) => (
            <li key={k} className="flex items-center gap-3 px-3.5 py-2.5">
              <span className="min-w-0 flex-1 font-bold">{i.name}{i.certainty === "likely" && <span className="ms-2 rounded bg-canvas px-1.5 py-0.5 text-[10px] font-extrabold text-ink-soft">{tr("محتمل", "likely")}</span>}</span>
              <span className="text-sm text-ink-soft tabular-nums">{Math.round(i.grams)} g</span>
              <span className="w-16 text-end text-sm font-extrabold tabular-nums">{Math.round(i.kcal)} {tr("سعرة", "kcal")}</span>
            </li>
          ))}
        </ul>
      </section>
      <section><h3 className="h2 mb-1">{tr("الحصة", "Portion")}</h3><p className="text-sm font-semibold">{s.portion}</p></section>
      {s.notes.length > 0 && <section><h3 className="h2 mb-2">{tr("ملاحظات", "Notes")}</h3><ul className="space-y-2">{s.notes.map((n, k) => (<li key={k} className="rounded-2xl bg-brand-50 p-3 text-sm">{n}</li>))}</ul></section>}
      <section><h3 className="h2 mb-2">{tr("افتراضات التقدير", "How this was estimated")}</h3><ul className="space-y-2">{s.assumptions.map((n, k) => (<li key={k} className="rounded-2xl bg-sun-50 p-3 text-sm">{n}</li>))}</ul></section>
      <Notice tone="info">{tr("هذه أرقام تقديرية من الصورة وليست قياسًا دقيقًا. الحصة والزيت والصلصات تغيّر النتيجة.", "These are photo-based estimates, not exact measurements. Portion, oil and sauces change the result.")}</Notice>
      {content.cautions.map((x, k) => (<Notice key={k} tone="warn">{lang === "ar" ? x.ar : x.en}</Notice>))}
      {content.doctor_note && <Notice tone="warn" icon="shieldCheck">{lang === "ar" ? content.doctor_note.ar : content.doctor_note.en}</Notice>}
      <footer className="border-t border-line pt-3 text-xs font-semibold text-ink-soft">{tr(DISCLAIMER_AR, DISCLAIMER_EN)}</footer>
    </article>
  );
}

export function CardView({ content, actions }: { content: CoachContent; actions?: ReactNode }) {
  const { tr, lang } = useApp();
  const c = content.card!;
  return (
    <article className="card space-y-5">
      <header>
        <p className="text-xs font-extrabold text-brand-600">{content.kind === "workout" ? tr("برنامج تمرين", "Workout") : tr("تحدٍّ مخصص", "Custom challenge")}</p>
        <h2 className="text-xl font-extrabold leading-snug">{c.name}</h2>
        <p className="muted mt-1">{c.summary}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {c.duration_min ? <span className="chip !cursor-default"><Icon name="clock" size={15} />{c.duration_min} {tr("د", "min")}</span> : null}
          {c.level ? <span className="chip !cursor-default !bg-brand-50 !text-brand-700">{c.level}</span> : null}
        </div>
      </header>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      {c.sections.map((s, i) => (
        <section key={i}>
          <h3 className="h2 mb-2">{s.heading}</h3>
          <ul className="space-y-2">{s.items.map((it, k) => (<li key={k} className="flex gap-3 rounded-2xl bg-brand-50/60 p-3 text-sm font-semibold"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-brand-600" /><span>{it}</span></li>))}</ul>
        </section>
      ))}
      {c.tips.length > 0 && <section><h3 className="h2 mb-2">{tr("نصائح", "Tips")}</h3><ul className="space-y-2">{c.tips.map((t, k) => (<li key={k} className="rounded-2xl bg-sun-50 p-3 text-sm">{t}</li>))}</ul></section>}
      {content.cautions.map((x, k) => (<Notice key={k} tone="warn">{lang === "ar" ? x.ar : x.en}</Notice>))}
      {content.doctor_note && <Notice tone="warn" icon="shieldCheck">{lang === "ar" ? content.doctor_note.ar : content.doctor_note.en}</Notice>}
      <footer className="border-t border-line pt-3 text-xs font-semibold text-ink-soft">{tr(DISCLAIMER_AR, DISCLAIMER_EN)}</footer>
    </article>
  );
}

export function RecipeView({ content, actions }: { content: RecipeContent; actions?: ReactNode }) {
  const { tr, lang } = useApp();
  const r = content.recipe;
  return (
    <article className="card space-y-5">
      <header>
        <h2 className="text-xl font-extrabold leading-snug">{r.name}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="chip !cursor-default"><Icon name="flame" size={15} className="text-sun-500" />{Math.round(r.calories)} {tr("سعرة", "kcal")}</span>
          <span className="chip !cursor-default"><Icon name="bolt" size={15} className="text-brand-600" />{Math.round(r.protein)} {tr("جم بروتين", "g protein")}</span>
          {r.suitable_for.slice(0, 3).map((s) => (<span key={s} className="chip !cursor-default !bg-brand-50 !text-brand-700">{s}</span>))}
        </div>
      </header>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      <section>
        <h3 className="h2 mb-2">{tr("المكونات", "Ingredients")}</h3>
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {r.ingredients.map((i, k) => (
            <li key={k} className="flex items-center justify-between gap-3 px-3.5 py-2.5"><span className="font-bold">{i.item}</span><span className="text-sm text-ink-soft">{i.quantity}</span></li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="h2 mb-2">{tr("طريقة التحضير", "Steps")}</h3>
        <ol className="space-y-2.5">
          {r.steps.map((s, k) => (
            <li key={k} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-extrabold text-white">{k + 1}</span><span className="pt-0.5">{s}</span></li>
          ))}
        </ol>
      </section>
      {r.benefits.length > 0 && (
        <section>
          <h3 className="h2 mb-2">{tr("فوائد المكونات الرئيسية", "Benefits of the main ingredients")}</h3>
          <ul className="space-y-2">{r.benefits.map((b, k) => (<li key={k} className="rounded-2xl bg-brand-50 p-3 text-sm"><b>{b.ingredient}:</b> {b.benefit}</li>))}</ul>
        </section>
      )}
      {r.substitutions.length > 0 && (
        <section>
          <h3 className="h2 mb-2">{tr("بدائل لو ناقصك حاجة", "Substitutions")}</h3>
          <ul className="space-y-2">{r.substitutions.map((s, k) => (<li key={k} className="rounded-2xl bg-sun-50 p-3 text-sm"><b>{s.missing}{lang === "ar" ? "؟" : "?"}</b> {s.use}</li>))}</ul>
        </section>
      )}
      {content.cautions.map((c, k) => (<Notice key={k} tone="warn">{lang === "ar" ? c.ar : c.en}</Notice>))}
      {content.doctor_note && <Notice tone="warn" icon="shieldCheck">{lang === "ar" ? content.doctor_note.ar : content.doctor_note.en}</Notice>}
      <footer className="border-t border-line pt-3 text-xs font-semibold text-ink-soft">{tr(DISCLAIMER_AR, DISCLAIMER_EN)}</footer>
    </article>
  );
}

type PriceItem = { key: "plan_monthly" | "pack_small" | "pack_large"; kind: "plan" | "pack"; pricePi: number; usd?: number; credits: number; days: number };

export const ITEM_COPY = {
  plan_monthly: { ar: "الخطة الشهرية", en: "Monthly plan", icon: "sparkles" },
  pack_small: { ar: "باقة كريدت صغيرة", en: "Small credit pack", icon: "bolt" },
  pack_large: { ar: "باقة كريدت كبيرة", en: "Large credit pack", icon: "bolt" },
} as const;

export function itemBenefits(i: PriceItem, tr: (a: string, e: string) => string): string[] {
  return i.kind === "plan"
    ? [tr(`${i.credits} طلب AI شهريًا (وجبات، تمارين، تحديات)`, `${i.credits} AI requests per month (meals, workouts, challenges)`), tr("نظام غذائي شخصي يتجدد كل أسبوع", "Personal diet plan refreshed weekly"), tr("تقرير أسبوعي مفصّل", "Weekly report"), tr(`صالحة ${i.days} يومًا من تاريخ الدفع`, `Valid ${i.days} days from payment`)]
    : [tr(`${i.credits} طلب AI (وجبات، تمارين، تحديات)`, `${i.credits} AI requests (meals, workouts, challenges)`), tr("بدون تاريخ انتهاء", "Never expires"), tr("كل طلب جديد = ١ كريدت", "Each new request = 1 credit")];
}

/** Pi payment sheet for plan and pack purchases (U2A only). The server verifies before granting anything. */
export function PaySheet({ item: itemIn, onClose, onPaid }: { item: PriceItem | null; onClose: () => void; onPaid: () => void }) {
  const { tr, me, toast } = useApp();
  const [fresh, setFresh] = useState<PriceItem | null>(null);
  useEffect(() => {
    setFresh(null);
    if (!itemIn) return;
    api<{ items: PriceItem[] }>("/pricing").then((r) => setFresh(r.items.find((x) => x.key === itemIn.key) ?? null)).catch(() => {});
  }, [itemIn]);
  const item = fresh ?? itemIn;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!item) return null;
  const copy = ITEM_COPY[item.key];

  const pay = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await payWithPi(item.key);
      if (r.ok) {
        toast(tr("تم الدفع بنجاح وتم تفعيل خدمتك", "Payment complete. Your service is active."), "ok");
        onPaid();
        onClose();
      } else if (r.reason === "cancelled") setMsg(tr("تم إلغاء الدفع. لم يُخصم أي مبلغ ويمكنك المحاولة مرة أخرى.", "Payment cancelled. Nothing was charged; you can try again."));
      else setMsg(tr(r.ar ?? "تعذّر إتمام الدفع. لم يتم منح أي شيء. حاول مرة أخرى.", r.en ?? "Payment could not be completed. Nothing was granted. Please try again."));
    } catch (e) {
      const x = e as { ar?: string; en?: string };
      setMsg(tr(x.ar ?? `تعذّر بدء الدفع${(e as Error)?.message ? ` (${(e as Error).message.slice(0, 80)})` : ""}.`, x.en ?? `Could not start the payment${(e as Error)?.message ? ` (${(e as Error).message.slice(0, 80)})` : ""}.`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={tr("تأكيد الشراء", "Confirm purchase")}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl bg-brand-50 p-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white"><Icon name={copy.icon} size={24} /></span>
          <div className="flex-1"><p className="font-extrabold">{tr(copy.ar, copy.en)}</p><p className="text-sm text-ink-soft">@{me?.profile.username}</p></div>
          <p className="text-2xl font-extrabold tabular-nums text-brand-800">{item.pricePi} <span className="text-base">Pi</span>{usdLabel(item.usd) && <span className="ms-2 text-sm font-bold text-ink-soft"><bdi dir="ltr">{usdLabel(item.usd)}</bdi></span>}</p>
        </div>
        <ul className="space-y-1.5 text-sm font-semibold">
          {itemBenefits(item, tr).map((b) => (<li key={b} className="flex items-center gap-2"><Icon name="check" size={16} className="text-brand-600" />{b}</li>))}
        </ul>
        {msg && <Notice tone="bad">{msg}</Notice>}
        {inPiContext() ? (
          <button className="btn-primary w-full" onClick={pay} disabled={busy}>
            {busy ? <Spinner /> : <Icon name="pi" />} {busy ? tr("جاري الدفع…", "Processing…") : tr(`ادفع ${item.pricePi} Pi`, `Pay ${item.pricePi} Pi`)}
          </button>
        ) : (
          <div className="space-y-2">
            <a className="btn-primary w-full" href={piBrowserUrl(`/pricing?buy=${item.key}&handoff=1`)}>
              <Icon name="pi" /> {tr("أكمل الدفع في Pi Browser", "Continue to pay in Pi Browser")}
            </a>
            <p className="muted text-center">{tr("الدفع بـ Pi يتم داخل Pi Browser فقط. بعد الدفع ارجع لهذا المتصفح، وسيظهر رصيدك المحدّث تلقائيًا.", "Paying with Pi works only inside Pi Browser. After paying, come back to this browser and your updated balance appears automatically.")}</p>
          </div>
        )}
        <p className="text-center text-xs text-ink-soft"><Link href="/pricing?tab=history" className="underline">{tr("سجل المدفوعات", "Payment history")}</Link></p>
      </div>
    </Sheet>
  );
}

export function WeightChart({ points }: { points: { date: string; kg: number; official: boolean }[] }) {
  const { tr } = useApp();
  if (points.length < 2) return <p className="muted py-6 text-center">{tr("سجّل وزنك مرتين على الأقل لرؤية الرسم البياني.", "Log your weight at least twice to see the chart.")}</p>;
  const W = 320, H = 150, pad = 26;
  const ys = points.map((p) => p.kg);
  const min = Math.min(...ys) - 1, max = Math.max(...ys) + 1;
  const x = (i: number) => pad + (i * (W - pad * 2)) / (points.length - 1);
  const y = (v: number) => H - pad - ((v - min) / (max - min)) * (H - pad * 2);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={tr("رسم بياني للوزن", "Weight chart")}>
      {[0, 1, 2].map((g) => (<line key={g} x1={pad} x2={W - pad} y1={pad + (g * (H - pad * 2)) / 2} y2={pad + (g * (H - pad * 2)) / 2} stroke="#dcebe5" strokeDasharray="4 4" />))}
      <path d={`${d} L${x(points.length - 1)} ${H - pad} L${x(0)} ${H - pad} Z`} fill="#10b981" opacity=".1" />
      <path d={d} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (<circle key={i} cx={x(i)} cy={y(p.kg)} r={p.official ? 4.5 : 3} fill={p.official ? "#059669" : "#fff"} stroke="#059669" strokeWidth="2" />))}
      <text x={pad} y={14} fontSize="11" fill="#4b6a61" fontWeight="700">{max.toFixed(0)} kg</text>
      <text x={pad} y={H - 6} fontSize="11" fill="#4b6a61" fontWeight="700">{min.toFixed(0)} kg</text>
      <text x={W - pad} y={H - 6} fontSize="11" fill="#4b6a61" textAnchor="end" fontWeight="700">{points[points.length - 1].date.slice(5)}</text>
    </svg>
  );
}
