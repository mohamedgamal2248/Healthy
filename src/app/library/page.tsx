"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useApp } from "@/components/AppProvider";
import { EmptyState, Gate, PageHeader, PageSkeleton } from "@/components/ui";
import { MealCard } from "@/components/MealCard";
import { Icon } from "@/components/Icon";
import type { MealRow } from "@/server/meals";
import type { RecipeContent } from "@/components/Domain";

type R = { id: string; title: string; content: RecipeContent; created_at: string; shared: boolean };

function Inner() {
  const { tr, toast, errMsg } = useApp();
  const [tab, setTab] = useState<"recipes" | "fav">("recipes");
  const [recipes, setRecipes] = useState<R[] | null>(null);
  const [favs, setFavs] = useState<{ meals: MealRow[]; recipes: R[] } | null>(null);
  useEffect(() => {
    api<{ recipes: R[] }>("/recipes").then((r) => setRecipes(r.recipes)).catch((e) => toast(errMsg(e), "err"));
    api<{ meals: MealRow[]; recipes: R[] }>("/favourites").then(setFavs).catch(() => {});
  }, [toast, errMsg]);
  const unfav = async (id: string) => { setFavs((f) => f && { ...f, meals: f.meals.filter((m) => m.id !== id) }); try { await api("/favourites", { body: { type: "meal", id } }); } catch (e) { toast(errMsg(e), "err"); } };
  if (!recipes || !favs) return <PageSkeleton />;
  const RecipeRow = ({ r }: { r: R }) => (
    <Link href={`/chef?recipe=${r.id}`} className="card flex items-center gap-3 !p-3.5 transition hover:shadow-md">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Icon name="chef" size={24} /></span>
      <div className="min-w-0 flex-1"><p className="truncate font-extrabold">{r.title}</p><p className="muted">{Math.round(r.content.recipe.calories)} {tr("سعرة", "kcal")} · {Math.round(r.content.recipe.protein)} {tr("جم بروتين", "g protein")}</p></div>
      {r.shared && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-600">{tr("مشارَكة", "Shared")}</span>}
      <Icon name="chevronL" size={20} className="text-ink-soft rtl:block ltr:hidden" /><Icon name="chevronR" size={20} className="text-ink-soft ltr:block rtl:hidden" />
    </Link>
  );
  return (
    <div className="py-5">
      <PageHeader title={tr("مكتبتي", "My library")} />
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-brand-50 p-1.5">
        {([["recipes", tr("وصفاتي من الشيف", "My AI recipes")], ["fav", tr("المفضلة", "Favourites")]] as const).map(([k, l]) => (<button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={`min-h-11 rounded-xl text-sm font-extrabold ${tab === k ? "bg-white text-brand-800 shadow-sm" : "text-ink-soft"}`}>{l}</button>))}
      </div>
      {tab === "recipes" ? (recipes.length ? <div className="space-y-2.5">{recipes.map((r) => <RecipeRow key={r.id} r={r} />)}</div> : <EmptyState icon="chef" title={tr("مفيش وصفات لسه", "No recipes yet")} body={tr("كل وصفة تولدها تتحفظ هنا تلقائيًا.", "Every recipe you generate is saved here automatically.")} action={<Link href="/chef" className="btn-primary">{tr("جرّب الشيف AI", "Try the AI Chef")}</Link>} />)
        : favs.meals.length + favs.recipes.length === 0 ? <EmptyState icon="heart" title={tr("مفيش مفضلات", "No favourites")} body={tr("اضغط على القلب في أي وجبة أو وصفة لحفظها.", "Tap the heart on any meal or recipe to save it.")} />
        : <div className="space-y-4">{favs.recipes.length > 0 && <div className="space-y-2.5">{favs.recipes.map((r) => <RecipeRow key={r.id} r={r} />)}</div>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{favs.meals.map((m) => <MealCard key={m.id} meal={m} fav onFav={unfav} />)}</div></div>}
    </div>
  );
}
export default function LibraryPage() { return <Gate><Inner /></Gate>; }
