"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useApp } from "@/components/AppProvider";
import { Gate, PageSkeleton } from "@/components/ui";
import { TagChips } from "@/components/MealCard";
import { Icon } from "@/components/Icon";
import type { MealRow } from "@/server/meals";

function Inner({ id }: { id: string }) {
  const { tr, lang, toast, errMsg } = useApp();
  const [m, setM] = useState<{ meal: MealRow; favourite: boolean } | null>(null);
  useEffect(() => { api<{ meal: MealRow; favourite: boolean }>(`/meals/${id}`).then(setM).catch((e) => toast(errMsg(e), "err")); }, [id, toast, errMsg]);
  if (!m) return <PageSkeleton />;
  const meal = m.meal;
  const toggle = async () => { setM({ ...m, favourite: !m.favourite }); try { await api("/favourites", { body: { type: "meal", id } }); } catch (e) { toast(errMsg(e), "err"); } };
  return (
    <div className="mx-auto max-w-3xl space-y-5 py-5">
      <Link href="/meals" className="inline-flex items-center gap-1 text-sm font-extrabold text-brand-700"><Icon name={lang === "ar" ? "arrowR" : "arrowL"} size={18} />{tr("كل الوجبات", "All meals")}</Link>
      <div className="card !p-0">
        <div className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <h1 className="h1">{lang === "ar" ? meal.name_ar : meal.name_en}</h1>
            <button onClick={toggle} aria-pressed={m.favourite} aria-label={tr("حفظ في المفضلة", "Save to favourites")} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line"><Icon name="heart" size={24} filled={m.favourite} className={m.favourite ? "text-rose-600" : "text-ink-soft"} /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[["clock", `${meal.time_min} ${tr("دقيقة", "min")}`, tr("التحضير", "Prep")], ["flame", `${meal.calories}`, tr("سعرة", "kcal")], ["bolt", `${meal.protein_g} ${tr("جم", "g")}`, tr("بروتين", "Protein")]].map(([ic, v, l]) => (
              <div key={l} className="rounded-2xl bg-brand-50 p-3 text-center"><Icon name={ic} size={20} className="mx-auto text-brand-600" /><p className="font-extrabold tabular-nums">{v}</p><p className="text-xs font-bold text-ink-soft">{l}</p></div>
            ))}
          </div>
          <p className="rounded-2xl bg-sun-50 p-3 text-sm font-semibold">{lang === "ar" ? meal.why_ar : meal.why_en}</p>
          <TagChips tags={meal.tags} max={6} />
        </div>
      </div>
      <section className="card"><h2 className="h2 mb-3">{tr("المكونات", "Ingredients")}</h2>
        <ul className="divide-y divide-line">{(lang === "en" && meal.ingredients_en ? meal.ingredients_en : meal.ingredients).map((i, k) => (<li key={k} className="flex justify-between gap-3 py-2.5"><span className="font-bold">{i.item}</span><span className="text-sm text-ink-soft">{i.qty}</span></li>))}</ul>
      </section>
      <section className="card"><h2 className="h2 mb-3">{tr("طريقة التحضير", "Steps")}</h2>
        <ol className="space-y-3">{(lang === "en" && meal.steps_en ? meal.steps_en : meal.steps).map((s, k) => (<li key={k} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-extrabold text-white">{k + 1}</span><span className="pt-0.5">{s}</span></li>))}</ol>
      </section>
      <p className="text-center text-xs font-semibold text-ink-soft">{tr("نصائح غذائية عامة، وليست تشخيصًا طبيًا أو بديلًا عن استشارة الطبيب", "General nutrition guidance, not a medical diagnosis or a substitute for consulting a doctor.")}</p>
    </div>
  );
}
export default function MealPage({ params }: { params: Promise<{ id: string }> }) { const { id } = use(params); return <Gate><Inner id={id} /></Gate>; }
