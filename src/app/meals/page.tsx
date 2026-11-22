"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useGet } from "@/lib/useGet";
import { useApp } from "@/components/AppProvider";
import { EmptyState, Gate, PageHeader, PageSkeleton } from "@/components/ui";
import { MealCard } from "@/components/MealCard";
import { Icon } from "@/components/Icon";
import { EatTabs } from "@/components/EatTabs";
import { INGREDIENTS, MEAL_TAGS } from "@/data/ingredients";
import type { MealRow } from "@/server/meals";

function MealsInner() {
  const { tr, lang, toast, errMsg } = useApp();
  const [tags, setTags] = useState<string[]>([]);
  const [type, setType] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [q, setQ] = useState("");
  const [qd, setQd] = useState("");
  useEffect(() => { const t = setTimeout(() => setQd(q), 250); return () => clearTimeout(t); }, [q]);
  const [mode, setMode] = useState<"browse" | "have">("browse");
  const [have, setHave] = useState<string[]>([]);
  const [favs, setFavs] = useState<string[]>([]);

  const qs = (() => {
    const p = new URLSearchParams();
    if (type) p.set("type", type);
    if (cuisine) p.set("cuisine", cuisine);
    if (tags.length) p.set("tags", tags.join(","));
    if (qd.trim()) p.set("q", qd.trim());
    if (mode === "have") p.set("have", have.length ? have.join(",") : "__none__");
    return p.toString();
  })();
  const { data: list } = useGet<{ meals: MealRow[] }>(`/meals?${qs}`, (e) => toast(errMsg(e), "err"));
  const meals = list?.meals ?? null;
  useEffect(() => { api<{ meals: MealRow[] }>("/favourites").then((f) => setFavs(f.meals.map((m) => m.id))).catch(() => {}); }, []);

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const fav = async (id: string) => {
    setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
    try { await api("/favourites", { body: { type: "meal", id } }); } catch (e) { toast(errMsg(e), "err"); }
  };
  const types = [["", tr("الكل", "All")], ["breakfast", tr("فطار", "Breakfast")], ["lunch", tr("غدا", "Lunch")], ["dinner", tr("عشا", "Dinner")]];
  const groups: [string, string][] = [["protein", tr("بروتين", "Protein")], ["dairy", tr("ألبان", "Dairy")], ["grain", tr("نشويات", "Starches")], ["veg", tr("خضار", "Vegetables")], ["fruit", tr("فاكهة", "Fruit")]];

  return (
    <div className="py-5">
      <EatTabs />
      <PageHeader title={tr("كتالوج الوجبات", "Meal catalogue")} sub={tr("وجبات مصرية صحية من مكونات رخيصة ومتوفرة", "Healthy Egyptian meals from cheap, easy-to-find ingredients")} />
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-brand-50 p-1.5">
        {([["browse", tr("تصفح الوجبات", "Browse")], ["have", tr("عندي المكونات دي", "I have these ingredients")]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k} className={`min-h-11 rounded-xl px-3 text-sm font-extrabold transition ${mode === k ? "bg-white text-brand-800 shadow-sm" : "text-ink-soft"}`}>{l}</button>
        ))}
      </div>

      {mode === "browse" ? (
        <div className="mb-5 space-y-3">
          <div className="relative"><Icon name="search" size={18} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-ink-soft" /><input className="field !ps-11" placeholder={tr("ابحث باسم الوجبة…", "Search meals…")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr("بحث", "Search")} /></div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={tr("المطبخ", "Cuisine")}>{[["", tr("كل المطابخ", "All cuisines")], ["egyptian", tr("مصري", "Egyptian")], ["international", tr("عالمي", "International")]].map(([k, l]) => (<button key={k} className="chip" aria-pressed={cuisine === k} onClick={() => setCuisine(k)}>{l}</button>))}</div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={tr("نوع الوجبة", "Meal type")}>{types.map(([k, l]) => (<button key={k} className="chip" aria-pressed={type === k} onClick={() => setType(k)}>{l}</button>))}</div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={tr("فلاتر", "Filters")}>{MEAL_TAGS.map((t) => (<button key={t.key} className="chip" aria-pressed={tags.includes(t.key)} onClick={() => toggle(tags, t.key, setTags)}>{tr(t.ar, t.en)}</button>))}</div>
        </div>
      ) : (
        <div className="card mb-5 space-y-4">
          <p className="muted">{tr("اختار المكونات اللي عندك في البيت وهنعرض الوجبات اللي تقدر تعملها بيها فقط (الملح والزيت والتوابل متوفرة دائمًا). هذا الوضع مجاني ولا يستهلك كريدت.", "Tick what you have at home and we show only meals you can make with it (salt, oil and spices are assumed). This mode is free and uses no credits.")}</p>
          {groups.map(([g, label]) => (
            <div key={g}>
              <p className="label">{label}</p>
              <div className="flex flex-wrap gap-2">{INGREDIENTS.filter((i) => i.group === g).map((i) => (<button key={i.key} className="chip" aria-pressed={have.includes(i.key)} onClick={() => toggle(have, i.key, setHave)}>{have.includes(i.key) && <Icon name="check" size={14} />}{lang === "ar" ? i.ar : i.en}</button>))}</div>
            </div>
          ))}
          {have.length > 0 && <button className="btn-ghost btn-sm" onClick={() => setHave([])}>{tr("مسح الاختيار", "Clear selection")}</button>}
        </div>
      )}

      {meals === null ? <PageSkeleton /> : meals.length === 0 ? (
        <EmptyState icon="utensils" title={mode === "have" && have.length === 0 ? tr("اختار مكوناتك", "Pick your ingredients") : tr("مفيش وجبات مطابقة", "No matching meals")} body={mode === "have" ? tr("جرّب تضيف مكونات أكتر وهتظهر وجبات.", "Try ticking more ingredients to see meals.") : tr("جرّب تغيّر الفلاتر.", "Try changing the filters.")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{meals.map((m) => (<MealCard key={m.id} meal={m} fav={favs.includes(m.id)} onFav={fav} />))}</div>
      )}
    </div>
  );
}
export default function MealsPage() { return <Gate><MealsInner /></Gate>; }
