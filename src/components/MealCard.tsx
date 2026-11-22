"use client";
import Link from "next/link";
import { Icon } from "./Icon";
import { useApp } from "./AppProvider";
import { INGREDIENT_MAP, MEAL_TAGS } from "@/data/ingredients";
import { hash } from "@/lib/dates";
import type { MealRow } from "@/server/meals";

const GROUP_COLOR: Record<string, string> = { protein: "#f59e0b", veg: "#34d399", grain: "#d6a15a", dairy: "#e2e8f0", fruit: "#fb7185" };
const TYPE_BG: Record<string, [string, string]> = { breakfast: ["#fef3c7", "#fde68a"], lunch: ["#d1fae5", "#a7f3d0"], dinner: ["#e0f2fe", "#bae6fd"] };

/** Original SVG plate illustration (used when a meal has no uploaded photo). */
export function MealArt({ meal, className = "" }: { meal: Pick<MealRow, "id" | "meal_type" | "ingredient_keys" | "photo_url" | "name_ar">; className?: string }) {
  if (meal.photo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={meal.photo_url} alt={meal.name_ar} className={`h-full w-full object-cover ${className}`} loading="lazy" />;
  }
  const [c1, c2] = TYPE_BG[meal.meal_type] ?? TYPE_BG.lunch;
  const keys = meal.ingredient_keys.length ? meal.ingredient_keys : ["tomato"];
  const blobs = keys.slice(0, 6).map((k, i) => {
    const h = hash(meal.id + k + i);
    const ang = ((h % 360) * Math.PI) / 180;
    const r = 14 + (h % 18);
    return { x: 60 + Math.cos(ang) * r, y: 60 + Math.sin(ang) * r, s: 9 + (h % 8), c: GROUP_COLOR[INGREDIENT_MAP[k]?.group ?? "veg"] };
  });
  return (
    <svg viewBox="0 0 120 120" className={`h-full w-full ${className}`} role="img" aria-label={meal.name_ar} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`bg-${meal.id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient>
      </defs>
      <rect width="120" height="120" fill={`url(#bg-${meal.id})`} />
      <ellipse cx="60" cy="68" rx="44" ry="12" fill="#064e3b" opacity=".10" />
      <circle cx="60" cy="60" r="42" fill="#fff" />
      <circle cx="60" cy="60" r="34" fill="#f1f5f3" />
      {blobs.map((b, i) => (<circle key={i} cx={b.x} cy={b.y} r={b.s} fill={b.c} opacity=".92" />))}
      <path d="M44 22c-3-5 3-7 0-12 M60 20c-3-5 3-7 0-12 M76 22c-3-5 3-7 0-12" stroke="#fff" strokeOpacity=".8" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
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

export function MealCard({ meal, fav, onFav, label }: { meal: MealRow; fav?: boolean; onFav?: (id: string) => void; label?: string }) {
  const { tr, lang } = useApp();
  return (
    <article className="card relative overflow-hidden !p-0">
      <Link href={`/meals/${meal.id}`} className="block">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-brand-50">
          <MealArt meal={meal} />
          {label && <span className="absolute start-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-extrabold text-brand-800 shadow-sm">{label}</span>}
        </div>
        <div className="space-y-2.5 p-4">
          <h3 className="text-base font-extrabold leading-snug">{lang === "ar" ? meal.name_ar : meal.name_en}</h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-ink-soft">
            <span className="inline-flex items-center gap-1"><Icon name="clock" size={15} />{meal.time_min} {tr("د", "min")}</span>
            <span className="inline-flex items-center gap-1"><Icon name="flame" size={15} className="text-sun-500" />{meal.calories} {tr("سعرة", "kcal")}</span>
            <span className="inline-flex items-center gap-1"><Icon name="bolt" size={15} className="text-brand-600" />{meal.protein_g} {tr("جم بروتين", "g protein")}</span>
            <span className="inline-flex items-center gap-1"><Icon name="coin" size={15} />~{meal.cost_egp} {tr("جنيه", "EGP")}</span>
          </div>
          <p className="muted line-clamp-2">{lang === "ar" ? meal.why_ar : meal.why_en}</p>
          <TagChips tags={meal.tags} />
        </div>
      </Link>
      {onFav && (
        <button onClick={() => onFav(meal.id)} aria-pressed={!!fav} aria-label={tr("حفظ في المفضلة", "Save to favourites")} className="absolute end-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-sm transition active:scale-90">
          <Icon name="heart" size={22} filled={fav} className={fav ? "text-rose-600" : "text-ink-soft"} />
        </button>
      )}
    </article>
  );
}
