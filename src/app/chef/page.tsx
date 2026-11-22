"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useApp, type Balances } from "@/components/AppProvider";
import { Gate, Notice, PageHeader, PageSkeleton, Spinner } from "@/components/ui";
import { DisclaimerBanner, ContentView, type CoachContent } from "@/components/Domain";
import { Icon } from "@/components/Icon";
import { CoachThinking } from "@/components/CoachThinking";

type Recipe = { id: string; title: string; content: CoachContent; shared: boolean };
type Kind = "recipe" | "workout" | "challenge";

const EXAMPLES: Record<Kind, { ar: string; en: string }[]> = {
  recipe: [
    { ar: "عندي بيض وجبنة قريش وطماطم", en: "I have eggs, cottage cheese and tomatoes" },
    { ar: "عايز غدا بـ 300 سعرة وبروتين عالي", en: "I want a 300 kcal, high-protein lunch" },
    { ar: "عندي عدس وأرز وبصل", en: "I have lentils, rice and onion" },
  ],
  workout: [
    { ar: "تمرين منزلي ١٥ دقيقة للمبتدئين بدون أجهزة", en: "A 15-minute beginner home workout, no equipment" },
    { ar: "حركة خفيفة بعد الأكل لتحسين النشاط", en: "Light movement after meals" },
  ],
  challenge: [
    { ar: "تحدي ٧ أيام لشرب مياه أكتر ونوم أحسن", en: "A 7-day challenge for more water and better sleep" },
    { ar: "تحدي أسبوع لتقليل السكر المضاف", en: "A one-week challenge to cut added sugar" },
  ],
};
const KINDS: { k: Kind; ar: string; en: string; icon: string }[] = [
  { k: "recipe", ar: "وجبة", en: "Meal", icon: "utensils" },
  { k: "workout", ar: "تمرين", en: "Workout", icon: "bolt" },
  { k: "challenge", ar: "تحدٍّ", en: "Challenge", icon: "flame" },
];

function ChefInner() {
  const { tr, lang, me, toast, errMsg, refresh } = useApp();
  const sp = useSearchParams();
  const openId = sp.get("recipe");
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<Kind>("recipe");
  const [busy, setBusy] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [fav, setFav] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [balances, setBalances] = useState<Balances | null>(me?.balances ?? null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [loadingOpen, setLoadingOpen] = useState(!!openId);

  const accepted = !!me?.profile.disclaimer_accepted_at;
  const total = balances?.total ?? 0;

  useEffect(() => { setBalances(me?.balances ?? null); }, [me]);

  const openRecipe = useCallback(async (id: string) => {
    try {
      const r = await api<{ recipe: Recipe; favourite: boolean; own: boolean }>(`/recipes/${id}`);
      setRecipe(r.recipe); setFav(r.favourite); setShareUrl(null);
    } catch (e) { toast(errMsg(e), "err"); } finally { setLoadingOpen(false); }
  }, [toast, errMsg]);
  useEffect(() => { if (openId) openRecipe(openId); }, [openId, openRecipe]);

  const generate = async () => {
    setBusy(true); setRefusal(null);
    try {
      const r = await api<{ recipe: Recipe; balances: Balances }>("/chef", { body: { prompt, kind, lang } });
      setRecipe(r.recipe); setFav(false); setShareUrl(null); setBalances(r.balances);
      refresh();
      toast(tr("تم حفظ الوصفة في مكتبتك", "Recipe saved to your library"), "ok");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      if (e instanceof ApiError && e.code === "refused") setRefusal(tr(e.ar, e.en));
      else toast(errMsg(e), "err");
      refresh().then((m) => m?.balances && setBalances(m.balances));
    } finally { setBusy(false); }
  };

  const toggleFav = async () => { if (!recipe) return; setFav(!fav); try { await api("/favourites", { body: { type: "recipe", id: recipe.id } }); } catch (e) { setFav(fav); toast(errMsg(e), "err"); } };
  const share = async () => {
    if (!recipe) return;
    try {
      const r = await api<{ url: string }>(`/recipes/${recipe.id}/share`, { body: { shared: true } });
      setShareUrl(r.url);
      try { await navigator.clipboard.writeText(r.url); toast(tr("تم النشر في المجتمع ونسخ الرابط", "Published to the community; link copied"), "ok"); } catch { /* shown below */ }
    } catch (e) { toast(errMsg(e), "err"); }
  };

  if (loadingOpen) return <PageSkeleton />;
  const canGenerate = prompt.trim().length >= 3 && !busy && accepted && total > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-5">
      <PageHeader title={tr("الكوتش", "AI Coach")} sub={tr("وجبات وتمارين وتحديات على مقاسك", "Meals, workouts and challenges made for you")} />
      {!accepted && <Notice tone="warn" icon="user"><div className="flex flex-wrap items-center gap-3"><span>{tr("وافق على التنبيه الصحي في ملفك أولًا.", "Accept the health disclaimer in your profile first.")}</span><Link href="/profile" className="btn-primary btn-sm">{tr("افتح الملف", "Open profile")}</Link></div></Notice>}

      {recipe ? (
        <>
          <button className="btn-soft btn-sm" onClick={() => setRecipe(null)}><Icon name="plus" size={18} />{tr("طلب جديد", "New request")}</button>
          <ContentView
            content={recipe.content}
            actions={<>
              <button className="btn-soft btn-sm" onClick={toggleFav} aria-pressed={fav}><Icon name="heart" size={18} filled={fav} className={fav ? "text-rose-600" : ""} />{fav ? tr("في المفضلة", "Saved") : tr("أضف للمفضلة", "Favourite")}</button>
              <button className="btn-soft btn-sm" onClick={share}><Icon name="share" size={18} />{tr("انشر في المجتمع + رابط", "Publish to community + link")}</button>
            </>}
          />
          {shareUrl && <div className="card flex items-center gap-2 !p-3"><Icon name="link" size={18} className="shrink-0 text-brand-600" /><input readOnly value={shareUrl} className="field !min-h-10 text-sm" dir="ltr" onFocus={(e) => e.currentTarget.select()} aria-label={tr("رابط المشاركة", "Share link")} /></div>}
        </>
      ) : (
        busy ? (
          <section className="card"><CoachThinking kind={kind} /></section>
        ) : (
        <>
          <section className="card space-y-4">
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-brand-50 p-1.5" role="tablist" aria-label={tr("نوع الطلب", "Request type")}>
              {KINDS.map((x) => (<button key={x.k} role="tab" aria-selected={kind === x.k} onClick={() => { setKind(x.k); setPrompt(""); }} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-extrabold transition ${kind === x.k ? "bg-white text-brand-800 shadow-sm" : "text-ink-soft"}`}><Icon name={x.icon} size={16} />{tr(x.ar, x.en)}</button>))}
            </div>
            <label className="block"><span className="label">{tr("إيه اللي عندك أو عايز إيه؟", "What do you have, or what do you want?")}</span>
              <textarea className="field !min-h-32 resize-none py-3 leading-relaxed" value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={400} placeholder={tr(kind === "recipe" ? "مثال: عندي بيض وجبنة قريش وطماطم" : kind === "workout" ? "مثال: تمرين منزلي ١٥ دقيقة للمبتدئين" : "مثال: تحدي ٧ أيام لشرب مياه أكتر", kind === "recipe" ? "e.g. I have eggs, cottage cheese and tomatoes" : kind === "workout" ? "e.g. a 15-minute beginner workout" : "e.g. a 7-day hydration challenge")} />
            </label>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">{EXAMPLES[kind].map((e) => (<button key={e.ar} className="chip shrink-0 whitespace-nowrap" onClick={() => setPrompt(lang === "ar" ? e.ar : e.en)}>{lang === "ar" ? e.ar : e.en}</button>))}</div>
            {refusal && <Notice tone="warn">{refusal}</Notice>}
            {total === 0 && accepted && <Notice tone="warn" icon="bolt"><div className="flex flex-wrap items-center gap-3"><span>{tr("رصيدك من الكريدت خلص. اكسب ٣ كريدت بتحدي البداية (٧ أيام) أو اشترِ كريدت.", "You're out of AI requests. Earn 3 with the 7-day starter challenge, or get more.")}</span><Link href="/today" className="btn-soft btn-sm">{tr("تحدي البداية", "Starter challenge")}</Link><Link href="/pricing" className="btn-sun btn-sm">{tr("اشترِ كريدت", "Get requests")}</Link></div></Notice>}
            <button className="btn-primary w-full" onClick={generate} disabled={!canGenerate}>{busy ? <Spinner /> : <Icon name="sparkles" />}{busy ? tr("الكوتش بيجهّز طلبك…", "The coach is working on it…") : tr("اطلب من الكوتش — 1 كريدت", "Ask the coach — 1 credit")}</button>
            <p className="muted text-center">{tr("لو فشل التوليد يرجع الكريدت تلقائيًا.", "If generation fails, your credit is refunded automatically.")}</p>
          </section>
          <DisclaimerBanner conditions={me?.profile.conditions} compact />
        </>
        )
      )}
    </div>
  );
}
export default function ChefPage() { return <Gate needVerified><Suspense fallback={<PageSkeleton />}><ChefInner /></Suspense></Gate>; }
