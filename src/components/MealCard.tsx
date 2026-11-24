"use client";
import Link from "next/link";
import { Icon } from "./Icon";
import { useApp } from "./AppProvider";
import { MEAL_TAGS } from "@/data/ingredients";
import type { MealRow } from "@/server/meals";
import { photoForMeal } from "@/data/dish-photos";

/** Real dish photo (lazy, fixed ratio so nothing jumps), or nothing when the dish has none. */
export function DishImage({ id, className = "" }: { id: string; className?: string }) {
  const p = photoForMeal(id);
  if (!p) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={p.src} alt="" width={640} height={400} loading="lazy" decoding="async" className={`aspect-[8/5] w-full object-cover ${className}`} />;
}

export function TagChips({ tags, max = 3 }: { tags: string[]; max?: number }) {
  const { tr } = useApp();
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.slice(0, max).map((t) => {
        const d = MEAL_TAGS.find((x) => x.key === t);
        return d ? <span key={t} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-700">{tr(d.ar, d.en)}</span> : null;
      })}
    </div>
  );
}

export function MealCard({ meal, fav, onFav, label, missing }: { meal: MealRow; fav?: boolean; onFav?: (id: string) => void; label?: string; missing?: string }) {
  const { tr, lang } = useApp();
  return (
    <article className="card relative !p-0">
      <Link href={`/meals/${meal.id}`} className="block">
        <DishImage id={meal.id} className="max-h-44 rounded-t-[inherit]" />
        <div className="space-y-2.5 p-4 pe-16">
          <div className="flex flex-wrap gap-1.5">
            {label && <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-extrabold text-brand-800">{label}</span>}
            {meal.cuisine === "international" && meal.origin_ar && <span className="inline-block rounded-full bg-sky-50 px-3 py-1 text-xs font-extrabold text-sky-600">{lang === "ar" ? meal.origin_ar : meal.origin_en}</span>}
          </div>
          <h3 className="text-base font-extrabold leading-snug">{lang === "ar" ? meal.name_ar : meal.name_en}</h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-ink-soft">
            <span className="inline-flex items-center gap-1"><Icon name="clock" size={15} />{meal.time_min} {tr("د", "min")}</span>
            <span className="inline-flex items-center gap-1"><Icon name="flame" size={15} className="text-sun-500" />{meal.calories} {tr("سعرة", "kcal")}</span>
            <span className="inline-flex items-center gap-1"><Icon name="bolt" size={15} className="text-brand-600" />{meal.protein_g} {tr("جم بروتين", "g protein")}</span>
          </div>
          <p className="text-sm font-semibold text-ink"><span className="text-ink-soft">{tr("المكونات: ", "Ingredients: ")}</span>{(lang === "en" && meal.ingredients_en ? meal.ingredients_en : meal.ingredients).map((i) => i.item).join(tr("، ", ", "))}</p>
          {missing && <p className="rounded-xl bg-sun-50 px-3 py-2 text-sm font-bold text-sun-600">{tr("ينقصك: ", "You need: ")}{missing}</p>}
          <p className="muted line-clamp-2">{lang === "ar" ? meal.why_ar : meal.why_en}</p>
          <TagChips tags={meal.tags} />
        </div>
      </Link>
      {onFav && (
        <button onClick={() => onFav(meal.id)} aria-pressed={!!fav} aria-label={tr("حفظ في المفضلة", "Save to favourites")} className="absolute end-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white transition active:scale-90">
          <Icon name="heart" size={22} filled={fav} className={fav ? "text-rose-600" : "text-ink-soft"} />
        </button>
      )}
    </article>
  );
}
