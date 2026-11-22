"use client";
import Link from "next/link";
import { Icon } from "./Icon";
import { useApp } from "./AppProvider";
import { MEAL_TAGS } from "@/data/ingredients";
import type { MealRow } from "@/server/meals";

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

export function MealCard({ meal, fav, onFav, label }: { meal: MealRow; fav?: boolean; onFav?: (id: string) => void; label?: string }) {
  const { tr, lang } = useApp();
  return (
    <article className="card relative !p-0">
      <Link href={`/meals/${meal.id}`} className="block">
        <div className="space-y-2.5 p-4 pe-16">
          {label && <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-extrabold text-brand-800">{label}</span>}
          <h3 className="text-base font-extrabold leading-snug">{lang === "ar" ? meal.name_ar : meal.name_en}</h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-ink-soft">
            <span className="inline-flex items-center gap-1"><Icon name="clock" size={15} />{meal.time_min} {tr("د", "min")}</span>
            <span className="inline-flex items-center gap-1"><Icon name="flame" size={15} className="text-sun-500" />{meal.calories} {tr("سعرة", "kcal")}</span>
            <span className="inline-flex items-center gap-1"><Icon name="bolt" size={15} className="text-brand-600" />{meal.protein_g} {tr("جم بروتين", "g protein")}</span>
            <span className="inline-flex items-center gap-1"><Icon name="coin" size={15} />~{meal.cost_egp} {tr("جنيه", "EGP")}</span>
          </div>
          <p className="text-sm font-semibold text-ink"><span className="text-ink-soft">{tr("المكونات: ", "Ingredients: ")}</span>{meal.ingredients.map((i) => i.item).join(tr("، ", ", "))}</p>
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
