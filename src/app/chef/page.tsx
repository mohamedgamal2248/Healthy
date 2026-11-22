"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useApp, type Balances } from "@/components/AppProvider";
import { Gate, Notice, PageHeader, PageSkeleton, Spinner } from "@/components/ui";
import { CreditBalance, DisclaimerBanner, RecipeView, type RecipeContent } from "@/components/Domain";
import { Icon } from "@/components/Icon";

type Recipe = { id: string; title: string; content: RecipeContent; shared: boolean };
type Msg = { id?: string; role: "user" | "assistant"; content: string };

const EXAMPLES = [
  { ar: "عندي بيض وجبنة قريش وطماطم", en: "I have eggs, cottage cheese and tomatoes" },
  { ar: "عايز غدا بـ 300 سعرة وبروتين عالي", en: "I want a 300 kcal, high-protein lunch" },
  { ar: "عندي عدس وأرز وبصل", en: "I have lentils, rice and onion" },
];

function ChefInner() {
  const { tr, lang, me, toast, errMsg, refresh } = useApp();
  const sp = useSearchParams();
  const openId = sp.get("recipe");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [fav, setFav] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState(false);
  const [balances, setBalances] = useState<Balances | null>(me?.balances ?? null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [loadingOpen, setLoadingOpen] = useState(!!openId);

  const accepted = !!me?.profile.disclaimer_accepted_at;
  const total = balances?.total ?? 0;

  useEffect(() => { setBalances(me?.balances ?? null); }, [me]);

  const openRecipe = useCallback(async (id: string) => {
    try {
      const r = await api<{ recipe: Recipe; messages: Msg[]; favourite: boolean; own: boolean }>(`/recipes/${id}`);
      setRecipe(r.recipe); setMsgs(r.messages); setFav(r.favourite); setShareUrl(null);
    } catch (e) { toast(errMsg(e), "err"); } finally { setLoadingOpen(false); }
  }, [toast, errMsg]);
  useEffect(() => { if (openId) openRecipe(openId); }, [openId, openRecipe]);

  const generate = async () => {
    setBusy(true); setRefusal(null);
    try {
      const r = await api<{ recipe: Recipe; balances: Balances }>("/chef", { body: { prompt } });
      setRecipe(r.recipe); setMsgs([]); setFav(false); setShareUrl(null); setBalances(r.balances);
      refresh();
      toast(tr("تم حفظ الوصفة في مكتبتك", "Recipe saved to your library"), "ok");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      if (e instanceof ApiError && e.code === "refused") setRefusal(tr(e.ar, e.en));
      else toast(errMsg(e), "err");
      refresh().then((m) => m?.balances && setBalances(m.balances));
    } finally { setBusy(false); }
  };

  const ask = async () => {
    if (!recipe || !q.trim()) return;
    setAsking(true);
    const question = q.trim();
    try {
      const r = await api<{ answer: string }>(`/recipes/${recipe.id}/followup`, { body: { question } });
      setMsgs((m) => [...m, { role: "user", content: question }, { role: "assistant", content: r.answer }]);
      setQ("");
    } catch (e) { toast(errMsg(e), "err"); } finally { setAsking(false); }
  };
  const toggleFav = async () => { if (!recipe) return; setFav(!fav); try { await api("/favourites", { body: { type: "recipe", id: recipe.id } }); } catch (e) { setFav(fav); toast(errMsg(e), "err"); } };
  const share = async () => {
    if (!recipe) return;
    try {
      const r = await api<{ url: string }>(`/recipes/${recipe.id}/share`, { body: { shared: true } });
      setShareUrl(r.url);
      try { await navigator.clipboard.writeText(r.url); toast(tr("تم نسخ رابط المشاركة", "Share link copied"), "ok"); } catch { /* shown below */ }
    } catch (e) { toast(errMsg(e), "err"); }
  };

  if (loadingOpen) return <PageSkeleton />;
  const canGenerate = prompt.trim().length >= 3 && !busy && accepted && total > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-5">
      <PageHeader title={tr("الشيف AI", "AI Chef")} sub={tr("اكتب اللي عندك أو هدفك، واحصل على وصفة كاملة", "Describe what you have or your target and get a full recipe")} />
      {!accepted && <Notice tone="warn" icon="user"><div className="flex flex-wrap items-center gap-3"><span>{tr("وافق على التنبيه الصحي في ملفك أولًا.", "Accept the health disclaimer in your profile first.")}</span><Link href="/profile" className="btn-primary btn-sm">{tr("افتح الملف", "Open profile")}</Link></div></Notice>}

      {recipe ? (
        <>
          <button className="btn-soft btn-sm" onClick={() => { setRecipe(null); setMsgs([]); }}><Icon name="plus" size={18} />{tr("وصفة جديدة", "New recipe")}</button>
          <RecipeView
            content={recipe.content}
            actions={<>
              <button className="btn-soft btn-sm" onClick={toggleFav} aria-pressed={fav}><Icon name="heart" size={18} filled={fav} className={fav ? "text-rose-600" : ""} />{fav ? tr("في المفضلة", "Saved") : tr("أضف للمفضلة", "Favourite")}</button>
              <button className="btn-soft btn-sm" onClick={share}><Icon name="share" size={18} />{tr("مشاركة برابط PiNet", "Share via PiNet link")}</button>
            </>}
          />
          {shareUrl && <div className="card flex items-center gap-2 !p-3"><Icon name="link" size={18} className="shrink-0 text-brand-600" /><input readOnly value={shareUrl} className="field !min-h-10 text-sm" dir="ltr" onFocus={(e) => e.currentTarget.select()} aria-label={tr("رابط المشاركة", "Share link")} /></div>}
          <section className="card space-y-3">
            <div className="flex items-center justify-between"><h2 className="h2">{tr("اسأل عن هذه الوصفة", "Ask about this recipe")}</h2><span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-extrabold text-brand-800">{tr("مجاني، بدون كريدت", "Free, no credit")}</span></div>
            {msgs.map((m, i) => (<div key={i} className={`max-w-[92%] rounded-2xl p-3 text-sm font-semibold leading-relaxed ${m.role === "user" ? "me-auto bg-brand-600 text-white" : "ms-auto bg-brand-50 text-ink"}`}>{m.content}</div>))}
            <div className="flex flex-wrap gap-2">{[tr("أقلل الملح إزاي؟", "How do I cut the salt?"), tr("تنفع للأطفال؟", "Is it suitable for kids?")].map((s) => (<button key={s} className="chip" onClick={() => setQ(s)}>{s}</button>))}</div>
            <div className="flex gap-2"><input className="field" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder={tr("اكتب سؤالك…", "Your question…")} maxLength={400} aria-label={tr("سؤال", "Question")} /><button className="btn-primary !px-4" onClick={ask} disabled={asking || !q.trim()} aria-label={tr("إرسال", "Send")}>{asking ? <Spinner size={20} /> : <Icon name="send" size={20} className="rtl:-scale-x-100" />}</button></div>
          </section>
        </>
      ) : (
        <>
          <section className="card space-y-4">
            <label className="block"><span className="label">{tr("إيه اللي عندك أو عايز إيه؟", "What do you have, or what do you want?")}</span>
              <textarea className="field !min-h-32 resize-none py-3 leading-relaxed" value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={600} placeholder={tr("مثال: عندي بيض وجبنة قريش وطماطم", "e.g. I have eggs, cottage cheese and tomatoes")} />
            </label>
            <div className="flex flex-wrap gap-2">{EXAMPLES.map((e) => (<button key={e.ar} className="chip" onClick={() => setPrompt(lang === "ar" ? e.ar : e.en)}>{lang === "ar" ? e.ar : e.en}</button>))}</div>
            <CreditBalance b={balances} />
            {refusal && <Notice tone="warn">{refusal}</Notice>}
            {total === 0 && accepted && <Notice tone="warn" icon="bolt"><div className="flex flex-wrap items-center gap-3"><span>{tr("رصيدك من الكريدت خلص.", "You're out of credits.")}</span><Link href="/pricing" className="btn-sun btn-sm">{tr("اشترِ كريدت", "Get credits")}</Link></div></Notice>}
            <button className="btn-primary w-full" onClick={generate} disabled={!canGenerate}>{busy ? <Spinner /> : <Icon name="sparkles" />}{busy ? tr("الشيف بيحضّر وصفتك…", "The chef is cooking your recipe…") : tr("توليد وصفة جديدة — 1 كريدت", "Generate new recipe — 1 credit")}</button>
            <p className="muted text-center">{tr("لو فشل التوليد يرجع الكريدت تلقائيًا. الأسئلة التالية على نفس الوصفة مجانية.", "If generation fails the credit is refunded automatically. Follow-up questions on the same recipe are free.")}</p>
          </section>
          <DisclaimerBanner conditions={me?.profile.conditions} compact />
        </>
      )}
    </div>
  );
}
export default function ChefPage() { return <Gate needVerified><Suspense fallback={<PageSkeleton />}><ChefInner /></Suspense></Gate>; }
