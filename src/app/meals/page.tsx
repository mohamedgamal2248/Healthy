"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useGet } from "@/lib/useGet";
import { useApp } from "@/components/AppProvider";
import { EmptyState, Gate, PageHeader, PageSkeleton } from "@/components/ui";
import { MealCard } from "@/components/MealCard";
import { Icon } from "@/components/Icon";
import { EatTabs } from "@/components/EatTabs";
import { INGREDIENTS, INGREDIENT_MAP, MEAL_TAGS } from "@/data/ingredients";
import { IngredientsAiSheet } from "@/components/IngredientsAi";
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
  const [aiOpen, setAiOpen] = useState(false);

  const qs = (() => {
    const p = new URLSearchParams();
    if (mode === "have") {
      p.set("have", have.length ? have.join(",") : "__none__"); // other filters are hidden in this mode, so they are not applied
    } else {
      if (type) p.set("type", type);
      if (cuisine) p.set("cuisine", cuisine);
      if (tags.length) p.set("tags", tags.join(","));
      if (qd.trim()) p.set("q", qd.trim());
    }
    return p.toString();
  })();
  const { data: list } = useGet<{ meals: MealRow[] }>(`/public/meals?${qs}`, (e) => toast(errMsg(e), "err"), { anon: true });
  const meals = list?.meals ?? null;
  useEffect(() => { api<{ meals: string[] }>("/favourites/ids").then((f) => setFavs(f.meals)).catch(() => {}); }, []);

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
      <PageHeader title={tr("كتالوج الوجبات", "Meal catalogue")} sub={tr("وجبات مصرية صحية من مكونات رخيصة ومتوفرة", "Healthy Egyptian and international meals from affordable, easy-to-find ingredients")} />
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
          <p className="muted">{tr("اختار المكونات اللي عندك. هنعرض الوجبات اللي تقدر تعملها دلوقتي، ثم وجبات ينقصها مكون أو اتنين بس. الملح والزيت والتوابل والبصل والتوم والليمون نعتبرها متوفرة. التصفح مجاني ولا يستهلك كريدت.", "Tick what you have. We show meals you can cook right now, then meals missing just one or two items. Salt, oil, spices, onion, garlic and lemon are assumed. Browsing is free and uses no credits.")}</p>
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
        <EmptyState icon="utensils" title={mode === "have" && have.length === 0 ? tr("اختار مكوناتك", "Pick your ingredients") : tr("مفيش وجبات مطابقة", "No matching meals")} body={mode === "have" ? (have.length === 0 ? tr("اختار مكونات من فوق وهتظهر وجبات.", "Tick some ingredients above to see meals.") : tr("مفيش وجبة جاهزة بالمكونات دي في الكتالوج. اطلب من Healthy AI وجبة جديدة منها.", "No catalogue meal fits these ingredients. Ask Healthy AI to create one.")) : tr("جرّب تغيّر الفلاتر.", "Try changing the filters.")} />
      ) : mode === "have" ? (
        <div className="space-y-6">
          {(() => {
            const ready = meals.filter((m) => !m.missing_keys?.length);
            const almost = meals.filter((m) => m.missing_keys?.length);
            const missingText = (m: MealRow) => (m.missing_keys ?? []).map((k) => (lang === "ar" ? INGREDIENT_MAP[k]?.ar : INGREDIENT_MAP[k]?.en) ?? k).join(tr("، ", ", "));
            return (
              <>
                {ready.length > 0 && (
                  <section>
                    <h2 className="h2 mb-3 flex items-center gap-2"><Icon name="check" size={20} className="text-brand-600" />{tr(`جاهزة للطبخ دلوقتي (${ready.length})`, `Ready to cook now (${ready.length})`)}</h2>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{ready.map((m) => (<MealCard key={m.id} meal={m} fav={favs.includes(m.id)} onFav={fav} />))}</div>
                  </section>
                )}
                {almost.length > 0 && (
                  <section>
                    <h2 className="h2 mb-3 flex items-center gap-2"><Icon name="plus" size={20} className="text-sun-600" />{tr(`قربت تعملها: ينقصك مكون أو اتنين (${almost.length})`, `Almost there: missing 1–2 items (${almost.length})`)}</h2>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{almost.map((m) => (<MealCard key={m.id} meal={m} missing={missingText(m)} fav={favs.includes(m.id)} onFav={fav} />))}</div>
                  </section>
                )}
              </>
            );
          })()}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{meals.map((m) => (<MealCard key={m.id} meal={m} fav={favs.includes(m.id)} onFav={fav} />))}</div>
      )}

      {mode === "have" && have.length > 0 && (
        <button onClick={() => setAiOpen(true)} className="card mt-6 flex w-full items-center gap-4 !border-brand-200 bg-gradient-to-br from-brand-50 to-white text-start transition hover:shadow-md">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg"><Icon name="sparkles" size={26} /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-extrabold">{tr("مش لاقي اللي عايزه؟ اطلب من Healthy AI", "Can't find what you want? Ask Healthy AI")}</span>
            <span className="muted block">{tr("وجبة جديدة من مكوناتك بالذات. بتخصم ١ كريدت (هنأكد معاك قبل الخصم).", "A brand-new meal from your exact ingredients. Uses 1 credit (we confirm before charging).")}</span>
          </span>
          <Icon name={lang === "ar" ? "chevronL" : "chevronR"} size={22} className="text-brand-600" />
        </button>
      )}
      <IngredientsAiSheet open={aiOpen} onClose={() => setAiOpen(false)} keys={have} />
    </div>
  );
}
export default function MealsPage() { return <Gate><MealsInner /></Gate>; }
