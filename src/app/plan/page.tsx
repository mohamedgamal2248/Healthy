"use client";
import { useCallback, useEffect, useState } from "react";
import { useGet } from "@/lib/useGet";
import Link from "next/link";
import { api } from "@/lib/api";
import { useApp, type Balances } from "@/components/AppProvider";
import { EmptyState, Gate, Notice, PageHeader, PageSkeleton, Spinner } from "@/components/ui";
import { DisclaimerBanner, PaySheet } from "@/components/Domain";
import { PricingGrid, type PriceItem } from "@/components/Pricing";
import { Icon } from "@/components/Icon";
import { EatTabs } from "@/components/EatTabs";
import type { StoredPlan } from "@/server/plan";

type Report = { week_start: string; weight_change: number | null; current_weight: number | null; streak: number; challenges_completed: number; favourite_meal: { name_ar: string; name_en: string } | null; avg_water: number | null; tip_ar: string; tip_en: string; insight?: string };
type PlanResp = { subscribed: boolean; week?: string; current?: StoredPlan | null; next?: StoredPlan | null; balances?: Balances; regenerateCost?: number; safety?: { cautions: { ar: string; en: string }[]; doctor_note: { ar: string; en: string } | null } };
const TYPE = { breakfast: ["فطار", "Breakfast", "sun"], lunch: ["غدا", "Lunch", "utensils"], dinner: ["عشا", "Dinner", "moon"] } as const;

type ShopItem = { key: string | null; item: string; item_en: string; group: string; uses: number; sample: string[] };
function Shopping({ week, which }: { week: string; which: "current" | "next" }) {
  const { tr, lang } = useApp();
  const { data } = useGet<{ items: ShopItem[] }>(`/plan/shopping?week=${which}`);
  const storeKey = `healthy.shop.${week}.${which}`;
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => { try { setDone(JSON.parse(localStorage.getItem(storeKey) ?? "[]")); } catch { setDone([]); } }, [storeKey]);
  const toggle = (id: string) => setDone((d) => { const n = d.includes(id) ? d.filter((x) => x !== id) : [...d, id]; try { localStorage.setItem(storeKey, JSON.stringify(n)); } catch {} return n; });
  if (!data || !data.items.length) return null;
  const groups: Record<string, [string, string]> = { protein: ["بروتين", "Protein"], dairy: ["ألبان", "Dairy"], veg: ["خضار", "Vegetables"], fruit: ["فاكهة", "Fruit"], grain: ["نشويات", "Starches"], other: ["أخرى", "Other"] };
  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between"><h2 className="h2">{tr("قائمة المشتريات", "Shopping list")}</h2><span className="muted tabular-nums">{done.length}/{data.items.length}</span></div>
      <p className="muted">{tr("المكونات التي تحتاجها لوجبات هذا الأسبوع، مع عدد الوجبات التي تستخدمها.", "Ingredients for this week's meals, with how many meals use each.")}</p>
      {Object.keys(groups).map((g) => {
        const list = data.items.filter((i) => i.group === g);
        if (!list.length) return null;
        return (
          <div key={g}>
            <p className="label">{lang === "ar" ? groups[g][0] : groups[g][1]}</p>
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {list.map((i) => { const id = i.key ?? i.item; const on = done.includes(id); return (
                <li key={id}><button onClick={() => toggle(id)} className="flex min-h-12 w-full items-center gap-3 px-3 text-start" aria-pressed={on}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-brand-600 bg-brand-600 text-white" : "border-brand-300"}`}>{on && <Icon name="check" size={14} />}</span>
                  <span className={`flex-1 font-bold ${on ? "text-ink-soft line-through" : ""}`}>{lang === "en" ? i.item_en : i.item}</span>
                  <span className="text-xs font-bold text-ink-soft">{tr(`${i.uses} وجبات`, `${i.uses} ${i.uses === 1 ? "meal" : "meals"}`)}</span>
                </button></li>); })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function Inner() {
  const { tr, lang, toast, errMsg, refresh, me } = useApp();
  const [d, setD] = useState<PlanResp | null>(null);
  const [which, setWhich] = useState<"current" | "next">("current");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [offer, setOffer] = useState<{ items: PriceItem[]; trialCredits: number } | null>(null);
  const [buy, setBuy] = useState<PriceItem | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<PlanResp>("/plan");
      setD(r);
      if (!r.subscribed) api<{ items: PriceItem[]; trialCredits: number }>("/pricing").then(setOffer).catch(() => {});
      else api<{ reports: { summary: Omit<Report, "tip_ar" | "tip_en"> & { tip_en: string }; tip: string; week_start: string }[] }>("/plan/report").then((x) => { const l = x.reports[0]; if (l) setReport({ ...l.summary, week_start: l.week_start, tip_ar: l.tip, tip_en: l.summary.tip_en }); }).catch(() => {});
    } catch (e) { toast(errMsg(e), "err"); }
  }, [toast, errMsg]);
  useEffect(() => { load(); }, [load]);

  if (!d) return <PageSkeleton />;

  if (!d.subscribed) {
    const plan = offer?.items.find((i) => i.key === "plan_monthly");
    return (
      <div className="mx-auto max-w-3xl space-y-5 py-5">
        <EatTabs />
        <PageHeader title={tr("نظامي الغذائي", "My diet plan")} sub={tr("للمشتركين في الخطة الشهرية", "For monthly plan subscribers")} />
        <div className="card space-y-4 bg-gradient-to-br from-brand-50 to-white">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white"><Icon name="plan" size={30} /></span>
          <h2 className="h2">{tr("خطة أسبوعية مبنية على ملفك الصحي", "A weekly plan built from your own profile")}</h2>
          <ul className="space-y-2 font-semibold">
            {[tr("سعرات يومية وهدف مياه حسب وزنك وطولك وعمرك وهدفك", "Daily calorie and water targets from your weight, height, age and goal"), tr("فطار وغدا وعشا لـ ٧ أيام من كتالوج الوجبات الرخيصة", "Breakfast, lunch and dinner for 7 days from the budget catalogue"), tr("تتجدد كل أسبوع عند تسجيل وزنك الجديد", "Refreshes every week when you log a new weight"), tr("تقرير أسبوعي بتقدمك ونصيحة عملية", "A weekly report with your progress and a practical tip")].map((b) => (<li key={b} className="flex gap-2"><Icon name="check" size={18} className="mt-1 shrink-0 text-brand-600" />{b}</li>))}
          </ul>
          {plan && <p className="text-2xl font-extrabold">{plan.pricePi} Pi <span className="text-base font-bold text-ink-soft">/ {tr("٣٠ يومًا، دفعة واحدة", "30 days, one payment")}</span></p>}
          {plan && <button className="btn-primary w-full sm:w-auto" onClick={() => setBuy(plan)} disabled={!me?.profile.kyc_verified}><Icon name="pi" />{tr("اشترك في الخطة الشهرية", "Subscribe to the monthly plan")}</button>}
          {!me?.profile.kyc_verified && <Notice tone="warn" icon="shieldCheck">{tr("الاشتراك متاح لحسابات Pi الموثقة (KYC) فقط.", "Subscribing needs a KYC-verified Pi account.")}</Notice>}
        </div>
        <DisclaimerBanner conditions={me?.profile.conditions} />
        {offer && <PricingGrid items={offer.items} trial={offer.trialCredits} />}
        <PaySheet item={buy} onClose={() => setBuy(null)} onPaid={() => { refresh(); load(); }} />
      </div>
    );
  }

  const plan = which === "next" ? d.next : d.current;
  const generate = async (mode: "auto" | "regenerate") => {
    if (mode === "regenerate" && !confirm(tr(`إعادة توليد الخطة تخصم ${d.regenerateCost} كريدت. متابعة؟`, `Regenerating costs ${d.regenerateCost} AI request. Continue?`))) return;
    setBusy(true);
    try { await api("/plan", { body: { mode } }); await load(); await refresh(); toast(tr("تم تحديث خطتك", "Your plan is ready"), "ok"); }
    catch (e) { toast(errMsg(e), "err"); } finally { setBusy(false); }
  };
  const makeReport = async () => { setBusy(true); try { const r = await api<{ report: Report }>("/plan/report", { body: {} }); setReport(r.report); } catch (e) { toast(errMsg(e), "err"); } finally { setBusy(false); } };
  const fmt = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString(tr("ar-EG", "en-GB"), { weekday: "long", day: "numeric", month: "short" });

  return (
    <div className="mx-auto max-w-4xl space-y-5 py-5">
      <EatTabs />
      <PageHeader title={tr("نظامي الغذائي", "My diet plan")} sub={d.week ? tr(`أسبوع يبدأ ${fmt(d.week)}`, `Week starting ${fmt(d.week)}`) : undefined} />
      <DisclaimerBanner conditions={me?.profile.conditions} />
      {d.safety?.cautions.map((c, i) => (<Notice key={i} tone="warn">{lang === "ar" ? c.ar : c.en}</Notice>))}

      {d.next && <div className="grid grid-cols-2 gap-2 rounded-2xl bg-brand-50 p-1.5">{([["current", tr("هذا الأسبوع", "This week")], ["next", tr("الأسبوع القادم", "Next week")]] as const).map(([k, l]) => (<button key={k} onClick={() => setWhich(k)} aria-pressed={which === k} className={`min-h-11 rounded-xl text-sm font-extrabold ${which === k ? "bg-white text-brand-800 shadow-sm" : "text-ink-soft"}`}>{l}</button>))}</div>}

      {!plan ? (
        <EmptyState icon="plan" title={tr("جاهز نبني خطتك؟", "Ready to build your plan?")} body={tr("الخطة الأولى مشمولة في اشتراكك ولا تخصم كريدت.", "Your first plan is included in your subscription and costs no credits.")} action={<button className="btn-primary" onClick={() => generate("auto")} disabled={busy}>{busy ? <Spinner /> : <Icon name="sparkles" />}{tr("أنشئ خطتي", "Build my plan")}</button>} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="card flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sun-50 text-sun-600"><Icon name="flame" size={26} /></span><div><p className="text-xs font-bold text-ink-soft">{tr("السعرات اليومية", "Daily calories")}</p><p className="text-2xl font-extrabold tabular-nums">{plan.daily_calorie_target}</p></div></div>
            <div className="card flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600"><Icon name="drop" size={26} /></span><div><p className="text-xs font-bold text-ink-soft">{tr("المياه اليومية", "Daily water")}</p><p className="text-2xl font-extrabold tabular-nums">{plan.daily_water_target} <span className="text-sm">{tr("أكواب", "cups")}</span></p></div></div>
          </div>
          {plan.plan.notes.gaps_unfilled > 0 && <Notice tone="info">{tr("بعض الوجبات لم يتوفر لها بديل مناسب لحالتك في الكتالوج.", "Some slots had no suitable catalogue meal for your conditions.")}</Notice>}
          <div className="space-y-3">
            {plan.plan.days.map((day) => (
              <section key={day.date} className="card !p-4">
                <div className="mb-3 flex items-center justify-between"><h3 className="font-extrabold">{fmt(day.date)}</h3><span className="rounded-full bg-sun-50 px-2.5 py-1 text-xs font-extrabold text-sun-600 tabular-nums">{day.total_kcal} {tr("سعرة", "kcal")}</span></div>
                <div className="grid gap-2 md:grid-cols-3">
                  {day.slots.map((s) => (
                    <div key={s.type} className="rounded-2xl bg-brand-50/60 p-3">
                      <p className="flex items-center gap-1.5 text-xs font-extrabold text-brand-700"><Icon name={TYPE[s.type][2]} size={14} />{lang === "ar" ? TYPE[s.type][0] : TYPE[s.type][1]}{s.source === "ai" && <span className="rounded bg-white px-1.5 text-[10px]">AI</span>}</p>
                      {s.meal_id ? <Link href={`/meals/${s.meal_id}`} className="mt-1 block font-extrabold leading-snug hover:underline">{lang === "ar" ? s.name_ar : s.name_en}</Link> : <p className="mt-1 font-extrabold leading-snug">{s.name_ar}</p>}
                      <p className="mt-1 text-xs font-bold text-ink-soft">{s.servings !== 1 && `${s.servings}× · `}{s.calories} {tr("سعرة", "kcal")} · {s.protein_g} {tr("جم", "g")}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div className="card flex flex-wrap items-center gap-3">
            <p className="muted flex-1">{tr("تتجدد خطتك تلقائيًا كل أسبوع عند تسجيل وزن جديد (مجانًا). غيّرت هدفك في منتصف الأسبوع؟", "Your plan refreshes weekly when you log a new weight (free). Changed your goal mid-week?")}</p>
            <button className="btn-soft btn-sm" onClick={() => generate("regenerate")} disabled={busy || (d.balances?.total ?? 0) < 1}><Icon name="refresh" size={18} />{tr(`إعادة التوليد — ${d.regenerateCost} كريدت`, `Regenerate — ${d.regenerateCost} request`)}</button>
          </div>
        </>
      )}

      {plan && <Shopping week={d.week ?? ""} which={which} />}

      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 className="h2">{tr("تقرير الأسبوع", "Weekly report")}</h2><button className="btn-soft btn-sm" onClick={makeReport} disabled={busy}><Icon name="refresh" size={18} />{tr("تحديث التقرير", "Update report")}</button></div>
        {report ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[[tr("تغيّر الوزن", "Weight change"), report.weight_change === null ? "—" : `${report.weight_change > 0 ? "+" : ""}${report.weight_change} kg`], [tr("السلسلة", "Streak"), String(report.streak)], [tr("تحديات منجزة", "Challenges done"), String(report.challenges_completed)], [tr("وجبة الأسبوع المفضلة", "Favourite meal"), report.favourite_meal ? (lang === "ar" ? report.favourite_meal.name_ar : report.favourite_meal.name_en) : "—"]].map(([l, v]) => (<div key={l} className="rounded-2xl bg-brand-50 p-3 text-center"><p className="text-xs font-bold text-ink-soft">{l}</p><p className="mt-1 text-sm font-extrabold leading-snug tabular-nums">{v}</p></div>))}
            </div>
            {report.insight && <div className="rounded-2xl border border-brand-200 bg-white p-3.5"><p className="mb-1 flex items-center gap-1.5 text-xs font-extrabold text-brand-700"><Icon name="sparkles" size={15} />{tr("ملخص Healthy AI لأسبوعك", "Healthy AI's take on your week")}</p><p className="text-sm font-semibold leading-relaxed">{report.insight}</p></div>}
            <Notice tone="ok" icon="sparkles">{tr(report.tip_ar, report.tip_en)}</Notice>
          </>
        ) : <p className="muted">{tr("اضغط تحديث التقرير لإنشاء تقرير هذا الأسبوع.", "Press Update report to create this week's report.")}</p>}
      </section>
    </div>
  );
}
export default function PlanPage() { return <Gate><Inner /></Gate>; }
