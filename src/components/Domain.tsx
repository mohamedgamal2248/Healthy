"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { useApp, type Balances } from "./AppProvider";
import { Notice, Sheet, Spinner } from "./ui";
import { DISCLAIMER_AR, DISCLAIMER_EN } from "@/lib/texts";
import { payWithPi } from "@/lib/pi-client";

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
  return (
    <div className={`rounded-2xl border border-sun-100 bg-sun-50 p-3.5 ${className}`}>
      <div className="flex items-center gap-2 text-sun-600">
        <Icon name="bolt" size={20} />
        <span className="text-sm font-extrabold text-ink">{tr("رصيدك من الكريدت", "Your credits")}</span>
        <span className="ms-auto text-2xl font-extrabold tabular-nums text-ink">{b.total}</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-xs font-bold text-ink-soft">
        <div className="rounded-xl bg-white/70 p-2"><dt>{tr("من الخطة", "Plan")}</dt><dd className="text-base font-extrabold text-ink tabular-nums">{b.plan}</dd></div>
        <div className="rounded-xl bg-white/70 p-2"><dt>{tr("من الباقات", "Packs")}</dt><dd className="text-base font-extrabold text-ink tabular-nums">{b.pack}</dd></div>
        <div className="rounded-xl bg-white/70 p-2"><dt>{tr("تجريبي", "Trial")}</dt><dd className="text-base font-extrabold text-ink tabular-nums">{b.trial}</dd></div>
      </dl>
      <p className="mt-2 text-xs font-semibold text-ink-soft">
        {b.planActive && date
          ? tr(`كريدت الخطة ينتهي مع نهاية الخطة في ${date}. كريدت الباقات لا ينتهي.`, `Plan credits expire when your plan ends on ${date}. Pack credits never expire.`)
          : tr("كريدت الباقات لا ينتهي. كريدت الخطة الشهرية ينتهي بانتهاء الخطة.", "Pack credits never expire. Monthly-plan credits expire when the plan ends.")}
      </p>
    </div>
  );
}

export type RecipeContent = {
  recipe: { name: string; ingredients: { item: string; quantity: string }[]; steps: string[]; calories: number; protein: number; benefits: { ingredient: string; benefit: string }[]; substitutions: { missing: string; use: string }[]; suitable_for: string[] };
  cautions: { ar: string; en: string }[];
  doctor_note: { ar: string; en: string } | null;
};

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
          <ul className="space-y-2">{r.substitutions.map((s, k) => (<li key={k} className="rounded-2xl bg-sun-50 p-3 text-sm"><b>{s.missing}؟</b> {s.use}</li>))}</ul>
        </section>
      )}
      {content.cautions.map((c, k) => (<Notice key={k} tone="warn">{lang === "ar" ? c.ar : c.en}</Notice>))}
      {content.doctor_note && <Notice tone="warn" icon="shieldCheck">{lang === "ar" ? content.doctor_note.ar : content.doctor_note.en}</Notice>}
      <footer className="border-t border-line pt-3 text-xs font-semibold text-ink-soft">{tr(DISCLAIMER_AR, DISCLAIMER_EN)}</footer>
    </article>
  );
}

type PriceItem = { key: "plan_monthly" | "pack_small" | "pack_large"; kind: "plan" | "pack"; pricePi: number; credits: number; days: number };

export const ITEM_COPY = {
  plan_monthly: { ar: "الخطة الشهرية", en: "Monthly plan", icon: "sparkles" },
  pack_small: { ar: "باقة كريدت صغيرة", en: "Small credit pack", icon: "bolt" },
  pack_large: { ar: "باقة كريدت كبيرة", en: "Large credit pack", icon: "bolt" },
} as const;

export function itemBenefits(i: PriceItem, tr: (a: string, e: string) => string): string[] {
  return i.kind === "plan"
    ? [tr(`${i.credits} كريدت شهريًا للشيف AI`, `${i.credits} AI Chef credits per month`), tr("نظام غذائي شخصي يتجدد كل أسبوع", "Personal diet plan refreshed weekly"), tr("تقرير أسبوعي مفصّل", "Weekly report"), tr(`صالحة ${i.days} يومًا من تاريخ الدفع`, `Valid ${i.days} days from payment`)]
    : [tr(`${i.credits} كريدت للشيف AI`, `${i.credits} AI Chef credits`), tr("بدون تاريخ انتهاء", "Never expires"), tr("وصفة جديدة = ١ كريدت", "One new recipe = 1 credit")];
}

/** Pi payment sheet for plan and pack purchases (U2A only). The server verifies before granting anything. */
export function PaySheet({ item, onClose, onPaid }: { item: PriceItem | null; onClose: () => void; onPaid: () => void }) {
  const { tr, me, toast } = useApp();
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
      setMsg(tr(x.ar ?? "تعذّر بدء الدفع.", x.en ?? "Could not start the payment."));
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
          <p className="text-2xl font-extrabold tabular-nums text-brand-800">{item.pricePi} <span className="text-base">Pi</span></p>
        </div>
        <ul className="space-y-1.5 text-sm font-semibold">
          {itemBenefits(item, tr).map((b) => (<li key={b} className="flex items-center gap-2"><Icon name="check" size={16} className="text-brand-600" />{b}</li>))}
        </ul>
        <Notice tone="info">{tr("دفعة واحدة من محفظتك إلى التطبيق. لا يوجد تجديد تلقائي: تجدّد يدويًا عند الانتهاء.", "A single payment from your wallet to the app. There is no automatic billing; you renew manually.")}</Notice>
        {msg && <Notice tone="bad">{msg}</Notice>}
        <button className="btn-primary w-full" onClick={pay} disabled={busy}>
          {busy ? <Spinner /> : <Icon name="pi" />} {busy ? tr("جاري الدفع…", "Processing…") : tr(`ادفع ${item.pricePi} Pi`, `Pay ${item.pricePi} Pi`)}
        </button>
        <p className="text-center text-xs text-ink-soft"><Link href="/wallet" className="underline">{tr("سجل المدفوعات في المحفظة", "Payment history in Wallet")}</Link></p>
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
