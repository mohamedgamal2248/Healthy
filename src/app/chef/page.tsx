"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useApp, type Balances } from "@/components/AppProvider";
import { Gate, Notice, PageHeader, PageSkeleton, Spinner, Tabs } from "@/components/ui";
import { LibraryView } from "@/components/Library";
import { ScanAdjust, ScanQuestions, hintsToNote, type ScanHints } from "@/components/ScanExtras";
import { DisclaimerBanner, ContentView, type CoachContent } from "@/components/Domain";
import { Icon } from "@/components/Icon";
import { RefineBar } from "@/components/Refine";
import { CoachThinking } from "@/components/CoachThinking";
import { CameraCapture } from "@/components/CameraCapture";
import { toCompressedDataUrl } from "@/lib/image";
import { CHAT } from "@/config/pricing";

type Recipe = { id: string; title: string; content: CoachContent; shared: boolean; duplicate?: boolean };
type Kind = "recipe" | "workout" | "challenge" | "scan" | "fridge" | "chat";
type Msg = { role: "user" | "assistant"; content: string; warn?: boolean; low?: boolean };
type DayInfo = { totals: { calories: number; protein_g: number }; target: number | null; targets: { protein: number } | null; entries: unknown[] };
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

const EXAMPLES: Record<Kind, { ar: string; en: string }[]> = {
  scan: [],
  chat: [
    { ar: "كم سعرة في رغيف عيش بلدي؟", en: "How many calories in a loaf of baladi bread?" },
    { ar: "إيه أحسن سناك بعد التمرين؟", en: "What is a good snack after a workout?" },
    { ar: "تمرين خفيف قبل النوم؟", en: "A light exercise before bed?" },
  ],
  fridge: [
    { ar: "بيض وجبنة قريش وطماطم وخيار", en: "eggs, cottage cheese, tomatoes and cucumber" },
    { ar: "رز وفراخ وكوسة", en: "rice, chicken and zucchini" },
  ],
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
const TILES: { k: Exclude<Kind, "scan" | "chat">; ar: string; en: string; icon: string }[] = [
  { k: "recipe", ar: "وصفة", en: "Recipe", icon: "utensils" },
  { k: "fridge", ar: "التلاجة", en: "Fridge", icon: "image" },
  { k: "workout", ar: "تمرين", en: "Workout", icon: "bolt" },
  { k: "challenge", ar: "تحدي ٧ أيام", en: "7-day goal", icon: "flame" },
];
const LABEL: Record<Kind, { ar: string; en: string }> = {
  scan: { ar: "صوّر طبقك", en: "Scan your plate" },
  chat: { ar: "اسأل المساعد", en: "Ask the coach" },
  recipe: { ar: "عايز أكلة معينة؟", en: "Want a specific dish?" },
  fridge: { ar: "إيه اللي عندك؟ (اكتب، أو صوّر وسيب الكتابة)", en: "What do you have? (type it, or just take a photo)" },
  workout: { ar: "إيه التمرين اللي عايزه؟", en: "What workout do you want?" },
  challenge: { ar: "عادة عايز تبنيها؟", en: "What habit do you want to build?" },
};

function ChefInner() {
  const { tr, lang, me, toast, errMsg, refresh } = useApp();
  const sp = useSearchParams();
  const openId = sp.get("recipe");
  const [view, setView] = useState<"new" | "mine">(sp.get("tab") === "mine" ? "mine" : "new");
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<Kind>(sp.get("kind") === "scan" ? "scan" : "recipe");
  const [hints, setHints] = useState<ScanHints>({ cook: null, size: null, extras: [] });
  const [busy, setBusy] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [tracked, setTracked] = useState(false);
  const [fav, setFav] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [balances, setBalances] = useState<Balances | null>(me?.balances ?? null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [loadingOpen, setLoadingOpen] = useState(!!openId);
  // meal-photo scan
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [camOpen, setCamOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nativeCamRef = useRef<HTMLInputElement>(null);
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try { setPhoto(await toCompressedDataUrl(f)); } catch { toast(tr("تعذّر قراءة الصورة. جرّب صورة أخرى.", "Couldn't read that photo. Try another one."), "err"); }
  };

  const [day, setDay] = useState<DayInfo | null>(null);
  const [chat, setChat] = useState<Msg[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  const [dur, setDur] = useState<number | null>(null);
  const [recent, setRecent] = useState<{ id: string; title: string; content: CoachContent }[] | null>(null);
  useEffect(() => { api<DayInfo>("/food").then(setDay).catch(() => {}); }, []);
  useEffect(() => { api<{ recipes: { id: string; title: string; content: CoachContent }[] }>("/recipes").then((r) => setRecent(r.recipes.slice(0, 3))).catch(() => setRecent([])); }, [recipe]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [chat, chatBusy]);

  const accepted = !!me?.profile.disclaimer_accepted_at;
  const total = balances?.total ?? 0;

  useEffect(() => { setBalances(me?.balances ?? null); }, [me]);
  useEffect(() => { refresh(); // the balance shown here must be the real one, e.g. right after a quick-start credit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const r = kind === "scan"
        ? await api<{ recipe: Recipe; balances: Balances }>("/coach/scan", { body: { image: photo, note: [hintsToNote(hints), note.trim()].filter(Boolean).join(" ").slice(0, 200), lang } })
        : kind === "fridge"
          ? await api<{ recipe: Recipe; balances: Balances }>("/coach/fridge", { body: { image: photo, text: prompt.trim(), lang } })
          : await api<{ recipe: Recipe; balances: Balances }>("/chef", { body: { prompt, kind, lang } });
      if (kind === "scan") { setPhoto(null); setNote(""); setHints({ cook: null, size: null, extras: [] }); }
      if (kind === "fridge") { setPhoto(null); setPrompt(""); }
      setRecipe(r.recipe); setFav(false); setShareUrl(null); setTracked(false); setBalances(r.balances);
      refresh();
      toast(r.recipe.duplicate ? tr("عندك نفس النتيجة محفوظة بالفعل، فرجّعنا لك الكريدت", "You already have this exact result saved, so your credit was returned") : tr("تم حفظ النتيجة في مكتبتك", "Result saved to your library"), "ok");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      if (e instanceof ApiError && e.code === "refused") setRefusal(tr(e.ar, e.en));
      else toast(errMsg(e), "err");
      refresh().then((m) => m?.balances && setBalances(m.balances));
    } finally { setBusy(false); }
  };

  const chatWords = words(chatText);
  const chatTooLong = chatWords > CHAT.maxUserWords || chatText.length > CHAT.maxUserChars;
  const sendChat = async () => {
    const text = chatText.trim();
    if (!text || chatBusy || chatTooLong || !accepted || total === 0) return;
    const history: Msg[] = [...chat, { role: "user", content: text }];
    setChat(history); setChatText(""); setChatBusy(true);
    try {
      const r = await api<{ reply: string; confidence: "high" | "low"; balances: Balances }>("/coach/chat", { body: { messages: history.filter((m) => !m.warn).slice(-(CHAT.historyMessages + 1)).map((m) => ({ role: m.role, content: m.content })), lang } });
      setChat((c) => [...c, { role: "assistant", content: r.reply, low: r.confidence === "low" }]);
      setBalances(r.balances); refresh();
    } catch (e) {
      // Off-topic / medical questions and failures are not charged: show why in the conversation and keep the rest of it.
      if (e instanceof ApiError && e.code === "refused") setChat((c) => [...c, { role: "assistant", content: tr(e.ar, e.en), warn: true }]);
      else { toast(errMsg(e), "err"); setChat(history.slice(0, -1)); setChatText(text); }
      refresh().then((m) => m?.balances && setBalances(m.balances));
    } finally { setChatBusy(false); }
  };

  const toggleFav = async () => { if (!recipe) return; setFav(!fav); try { await api("/favourites", { body: { type: "recipe", id: recipe.id } }); } catch (e) { setFav(fav); toast(errMsg(e), "err"); } };
  const addToDay = async () => { if (!recipe) return; try { await api("/food", { body: { source: "recipe", recipeId: recipe.id } }); toast(tr("تمت الإضافة إلى يومك", "Added to your day"), "ok"); } catch (e) { toast(errMsg(e), "err"); } };
  const track = async () => {
    if (!recipe) return;
    try {
      const r = await api<{ started: boolean; already: boolean; days: number }>(`/recipes/${recipe.id}/track`, { body: {} });
      setTracked(true);
      window.dispatchEvent(new Event("healthy:refresh"));
      toast(r.already ? tr("متتبَّع بالفعل في تحديات اليوم", "Already tracked in today's challenges") : tr("اتضاف إلى تحديات اليوم", "Added to today's challenges"), "ok");
    } catch (e) { toast(errMsg(e), "err"); }
  };
  const share = async () => {
    if (!recipe) return;
    try {
      const r = await api<{ url: string }>(`/recipes/${recipe.id}/share`, { body: { shared: true } });
      setShareUrl(r.url);
      try { await navigator.clipboard.writeText(r.url); toast(tr("تم النشر في المجتمع ونسخ الرابط", "Published to the community; link copied"), "ok"); } catch { /* shown below */ }
    } catch (e) { toast(errMsg(e), "err"); }
  };

  if (loadingOpen) return <PageSkeleton />;
  const remaining = day?.target ? Math.max(0, Math.round((day.target - day.totals.calories) / 10) * 10) : null;
  const protLeft = day?.targets && day.entries.length > 0 ? Math.max(0, Math.round(day.targets.protein - day.totals.protein_g)) : 0;
  const canGenerate = (kind === "scan" ? !!photo : kind === "fridge" ? !!photo || prompt.trim().length >= 3 : prompt.trim().length >= 3) && !busy && accepted && total > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-5">
      <PageHeader title={tr("Healthy AI", "Healthy AI")} sub={tr("وجبات وتمارين وتحديات على مقاسك", "Meals, workouts and challenges made for you")} />
      {!accepted && <Notice tone="warn" icon="user"><div className="flex flex-wrap items-center gap-3"><span>{tr("وافق على التنبيه الصحي في ملفك أولًا.", "Accept the health disclaimer in your profile first.")}</span><Link href="/profile" className="btn-primary btn-sm">{tr("افتح الملف", "Open profile")}</Link></div></Notice>}

      {!recipe && !busy && <Tabs label={tr("القسم", "Section")} value={view} onChange={setView} tabs={[["new", tr("طلب جديد", "New")], ["mine", tr("نتائجي", "My results")]] as const} />}

      {!recipe && !busy && view === "mine" ? <LibraryView /> : recipe ? (
        <>
          <button className="btn-soft btn-sm" onClick={() => setRecipe(null)}><Icon name="plus" size={18} />{tr("طلب جديد", "New request")}</button>
          {recipe.content.kind === "scan" && recipe.content.scan && (
            <ScanAdjust
              recipeId={recipe.id}
              name={lang === "ar" && recipe.content.scan.dish_name_local ? recipe.content.scan.dish_name_local : recipe.content.scan.dish_name}
              totals={recipe.content.scan.totals}
              ingredients={recipe.content.scan.ingredients}
              confidence={recipe.content.scan.confidence}
              onAdded={() => window.dispatchEvent(new Event("healthy:refresh"))}
            />
          )}
          {(recipe.content.kind === "recipe" || recipe.content.kind === "workout") && recipe.content.kind && <RefineBar key={recipe.id} id={recipe.id} kind={recipe.content.kind} onResult={(r) => { setRecipe(r); setFav(false); setShareUrl(null); setTracked(false); }} />}
          <ContentView
            content={recipe.content}
            actions={<>
              <button className="btn-soft btn-sm" onClick={toggleFav} aria-pressed={fav}><Icon name="heart" size={18} filled={fav} className={fav ? "text-rose-600" : ""} />{fav ? tr("في المفضلة", "Saved") : tr("أضف للمفضلة", "Favourite")}</button>
              {recipe.content.kind === "recipe" && <button className="btn-soft btn-sm" onClick={addToDay}><Icon name="plus" size={18} />{tr("أضف إلى يومي", "Add to my day")}</button>}
              {(recipe.content.kind === "workout" || recipe.content.kind === "challenge") && <button className="btn-soft btn-sm" onClick={track} disabled={tracked}><Icon name={tracked ? "check" : "flame"} size={18} />{tracked ? tr("في تحديات اليوم", "In today's challenges") : recipe.content.kind === "challenge" ? tr("ابدأ التحدي (٧ أيام)", "Start the challenge (7 days)") : tr("ابدأه كتحدي اليوم", "Start it as today's challenge")}</button>}
              {recipe.content.kind === "recipe" && <button className="btn-soft btn-sm" onClick={share}><Icon name="share" size={18} />{tr("انشر في المجتمع + رابط", "Publish to community + link")}</button>}
            </>}
          />
          {shareUrl && <div className="card flex items-center gap-2 !p-3"><Icon name="link" size={18} className="shrink-0 text-brand-600" /><input readOnly value={shareUrl} className="field !min-h-10 text-sm" dir="ltr" onFocus={(e) => e.currentTarget.select()} aria-label={tr("رابط المشاركة", "Share link")} /></div>}
        </>
      ) : (
        busy ? (
          <section className="card"><CoachThinking kind={kind === "chat" ? "recipe" : kind} /></section>
        ) : (
        <>
          <section className="space-y-3">
            {day?.target ? (
              <Link href="/diary" className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-2.5 text-sm font-bold">
                <span className="min-w-0">{day.entries.length === 0 ? tr("لسه مسجّلتش أكل النهارده", "Nothing logged yet today") : tr(`فاضلك ${remaining} سعرة${protLeft ? ` و${protLeft} جم بروتين` : ""} النهارده`, `${remaining} kcal${protLeft ? ` and ${protLeft} g protein` : ""} left today`)}</span>
                <span className="muted shrink-0">{tr("يومياتي", "Diary")}</span>
              </Link>
            ) : null}
            <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label={tr("نوع الطلب", "Request type")}>
              {([["scan", "camera", tr("صوّر طبقك", "Scan your plate"), tr("سعرات تقديرية في ثواني", "Calories in seconds")], ["chat", "chat", tr("اسأل المساعد", "Ask the coach"), tr("رد قصير عن الأكل والتمرين", "Short answers on food and fitness")]] as const).map(([k, icon, title, sub]) => {
                const on = kind === k;
                return (
                  <button key={k} role="radio" aria-checked={on} onClick={() => { setKind(k); setPrompt(""); }} className={`flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-3 text-center transition active:scale-95 ${on ? "border-brand-600 bg-brand-50 shadow-sm" : "border-line bg-white"}`}>
                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${on ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600"}`}><Icon name={icon} size={24} /></span>
                    <span className="text-base font-extrabold leading-tight">{title}</span>
                    <span className="text-xs font-semibold text-ink-soft">{sub}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={tr("أنواع أخرى", "More types")}>
              {TILES.map((x) => {
                const on = kind === x.k;
                return (
                  <button key={x.k} role="radio" aria-checked={on} onClick={() => { setKind(x.k); setPrompt(""); setDur(null); }} className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-1 py-2 text-center transition active:scale-95 ${on ? "border-brand-600 bg-brand-50" : "border-line bg-white"}`}>
                    <Icon name={x.icon} size={22} className={on ? "text-brand-700" : "text-brand-600"} />
                    <span className="text-xs font-extrabold leading-tight">{tr(x.ar, x.en)}</span>
                  </button>
                );
              })}
            </div>
            <p className="muted text-center">{tr("كل طلب أو رسالة = ١ كريدت. لو فشل أو كان خارج النطاق يرجع الكريدت تلقائيًا.", "Every request or message = 1 credit. If it fails or is out of scope, it is refunded automatically.")}</p>
          </section>

          <section className="card space-y-4">
            {kind === "chat" ? (
              <div className="space-y-3">
                <Notice tone="info" icon="info">{tr(`أجاوب فقط عن الأكل والسعرات والتمارين المنزلية والعادات اليومية. ردودي قصيرة، وسؤالك حتى ${CHAT.maxUserWords} كلمة.`, `I only answer about food, calories, home workouts and daily habits. Replies are short and your question can be up to ${CHAT.maxUserWords} words.`)}</Notice>
                {chat.length > 0 ? (
                  <div className="max-h-[48vh] min-h-40 space-y-2.5 overflow-y-auto rounded-2xl bg-brand-50/60 p-2.5" aria-live="polite">
                    {chat.map((m, i) => (
                      <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <p className={`max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm font-semibold leading-relaxed ${m.role === "user" ? "bg-brand-600 text-white" : m.warn ? "border border-sun-100 bg-sun-50 text-sun-600" : "border border-line bg-white text-ink"}`}>
                          {m.content}
                          {m.low && <span className="mt-1 block text-xs font-bold opacity-70">{tr("تقدير غير مؤكد. للدقة صوّر الوجبة أو راجع مختصًا.", "Not certain. For accuracy, scan the meal or check with a professional.")}</span>}
                          {m.warn && <span className="mt-1 block text-xs font-bold opacity-70">{tr("لم يُخصم كريدت.", "No credit was used.")}</span>}
                        </p>
                      </div>
                    ))}
                    {chatBusy && <div className="flex justify-start"><p className="rounded-2xl border border-line bg-white px-3.5 py-2.5"><Spinner size={18} /></p></div>}
                    <div ref={chatEnd} />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">{EXAMPLES.chat.map((e) => (<button key={e.ar} className="chip" onClick={() => setChatText(lang === "ar" ? e.ar : e.en)}>{lang === "ar" ? e.ar : e.en}</button>))}</div>
                )}
                <div className="flex items-end gap-2">
                  <label className="block min-w-0 flex-1">
                    <span className="sr-only">{tr("سؤالك", "Your question")}</span>
                    <textarea className="field !min-h-12 resize-none py-3 leading-snug" rows={2} value={chatText} onChange={(e) => setChatText(e.target.value.slice(0, CHAT.maxUserChars + 40))} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }} placeholder={tr("اكتب سؤالك هنا…", "Type your question…")} />
                  </label>
                  <button className="btn-primary !min-h-12 shrink-0" onClick={sendChat} disabled={!chatText.trim() || chatBusy || chatTooLong || !accepted || total === 0} aria-label={tr("إرسال بكريدت واحد", "Send for 1 credit")}>{chatBusy ? <Spinner size={18} /> : <Icon name="send" size={20} />}<span>{tr("١ كريدت", "1 credit")}</span></button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-bold tabular-nums ${chatTooLong ? "text-rose-600" : "text-ink-soft"}`} dir="ltr">{chatWords}/{CHAT.maxUserWords} {tr("كلمة", "words")}</span>
                  {chat.length > 0 && <button className="btn-ghost btn-sm" onClick={() => { setChat([]); setChatText(""); }}><Icon name="refresh" size={16} />{tr("محادثة جديدة", "New chat")}</button>}
                </div>
                {chatTooLong && <p className="text-xs font-bold text-rose-600">{tr(`السؤال أطول من ${CHAT.maxUserWords} كلمة. اختصره.`, `That is over ${CHAT.maxUserWords} words. Please shorten it.`)}</p>}
              </div>
            ) : kind === "scan" ? (
              <div className="space-y-3">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
                <input ref={nativeCamRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
                {photo ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt={tr("صورة وجبتك", "Your meal photo")} className="max-h-72 w-full rounded-2xl border border-line object-cover" />
                    <div className="flex gap-2"><button className="btn-soft btn-sm flex-1" onClick={() => setPhoto(null)}><Icon name="refresh" size={16} />{tr("إعادة التصوير", "Retake")}</button><button className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()}><Icon name="image" size={16} />{tr("صورة أخرى", "Other photo")}</button></div>
                    <ScanQuestions value={hints} onChange={setHints} />
                    <label className="block"><span className="label">{tr("معلومة إضافية (اختياري)", "Extra detail (optional)")}</span><input className="field" value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder={tr("مثال: من مطعم، متقلي بزيت كتير", "e.g. from a restaurant, deep fried")} maxLength={200} /></label>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <button className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 font-extrabold text-brand-800 transition active:scale-95" onClick={() => setCamOpen(true)}><Icon name="camera" size={32} />{tr("افتح الكاميرا", "Open camera")}</button>
                      <button className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-white font-extrabold text-ink-soft transition active:scale-95" onClick={() => fileRef.current?.click()}><Icon name="image" size={32} />{tr("اختر من الصور", "Choose a photo")}</button>
                    </div>
                    <p className="muted">{tr("صوّر الوجبة من فوق وبإضاءة كويسة وخلّي الطبق كله ظاهر. Healthy AI بيقدّر المكونات والسعرات والبروتين.", "Shoot the meal from above in good light with the whole plate visible. Healthy AI estimates ingredients, calories and protein.")}</p>
                  </>
                )}
                <Notice tone="warn" icon="bolt">
                  <b>{tr("التحليل بيخصم ١ كريدت.", "Analysing uses 1 AI request.")}</b>{" "}
                  {tr(`رصيدك: ${total}. الصورة بتتبعت لمزوّد الذكاء الاصطناعي للتحليل ولا تُحفظ عندنا، والنتيجة تقديرية.`, `Your balance: ${total}. The photo is sent to the AI provider for analysis and is not stored by us. Results are estimates.`)}
                </Notice>
              </div>
            ) : (
              <>
            <p className="label">{tr(LABEL[kind].ar, LABEL[kind].en)}</p>
            {kind === "workout" && (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label={tr("مدة التمرين", "Workout length")}>
                {[10, 15, 20, 30].map((m) => (<button key={m} className="chip" aria-pressed={dur === m} onClick={() => { setDur(m); setPrompt(lang === "ar" ? `تمرين منزلي ${m} دقيقة للمبتدئين` : `A ${m}-minute home workout for beginners`); }}>{m} {tr("دقيقة", "min")}</button>))}
              </div>
            )}
            <textarea className="field !min-h-20 resize-none py-3 leading-relaxed" rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={400} aria-label={tr(LABEL[kind].ar, LABEL[kind].en)} placeholder={tr(kind === "fridge" ? "مثال: بيض وجبنة قريش وطماطم وخيار" : kind === "recipe" ? "مثال: وجبة غدا ٣٠٠ سعرة وبروتين عالي" : kind === "workout" ? "مثال: تمرين منزلي ١٥ دقيقة للمبتدئين" : "مثال: تحدي ٧ أيام لشرب مياه أكتر", kind === "fridge" ? "e.g. eggs, cottage cheese, tomatoes, cucumber" : kind === "recipe" ? "e.g. a 300 kcal high-protein lunch" : kind === "workout" ? "e.g. a 15-minute beginner workout" : "e.g. a 7-day hydration challenge")} />
            {kind === "fridge" && (
              <div className="space-y-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
                <input ref={nativeCamRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
                {photo ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-line p-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt={tr("صورة ما عندك", "Photo of what you have")} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                    <span className="min-w-0 flex-1 text-sm font-bold text-ink-soft">{tr("هنقرأ المكونات من الصورة", "We'll read the ingredients from the photo")}</span>
                    <button className="btn-ghost btn-sm" onClick={() => setPhoto(null)} aria-label={tr("إزالة الصورة", "Remove photo")}><Icon name="x" size={18} /></button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" className="btn-soft" onClick={() => setCamOpen(true)}><Icon name="camera" size={18} />{tr("صوّر التلاجة", "Photo of fridge")}</button>
                    <button type="button" className="btn-soft" onClick={() => fileRef.current?.click()}><Icon name="image" size={18} />{tr("اختر صورة", "Choose a photo")}</button>
                  </div>
                )}
                <p className="muted">{tr("بنقترح ٣ أفكار من اللي عندك بحسب تفضيلاتك وباقي سعراتك اليوم. الصورة بتتبعت لمزوّد الذكاء الاصطناعي ولا تُحفظ عندنا.", "We suggest 3 ideas from what you have, matched to your preferences and what's left of today's calories. The photo goes to the AI provider and is not stored by us.")}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {kind === "recipe" && remaining !== null && remaining >= 150 && (() => { const k = Math.min(700, Math.max(200, Math.round(remaining / 2 / 10) * 10)); return <button className="chip" onClick={() => setPrompt(lang === "ar" ? `وجبة بحوالي ${k} سعرة تكمّل يومي` : `A ~${k} kcal meal that fits my day`)}>{tr(`وجبة بحوالي ${k} سعرة تناسب يومك`, `A ~${k} kcal meal that fits your day`)}</button>; })()}
              {EXAMPLES[kind].map((e) => (<button key={e.ar} className="chip" onClick={() => setPrompt(lang === "ar" ? e.ar : e.en)}>{lang === "ar" ? e.ar : e.en}</button>))}
            </div>
              </>
            )}
            {kind !== "chat" && refusal && <Notice tone="warn">{refusal}</Notice>}
            {total === 0 && accepted && <Notice tone="warn" icon="bolt"><div className="flex flex-wrap items-center gap-3"><span>{tr("رصيدك من الكريدت خلص. اكسب ٣ كريدت بتحدي البداية (٧ أيام) أو اشترِ كريدت.", "You're out of AI requests. Earn 3 with the 7-day starter challenge, or get more.")}</span><Link href="/today" className="btn-soft btn-sm">{tr("تحدي البداية", "Starter challenge")}</Link><Link href="/pricing" className="btn-sun btn-sm">{tr("اشترِ كريدت", "Get requests")}</Link></div></Notice>}
            {kind !== "chat" && (
              <>
                <button className="btn-primary w-full" onClick={generate} disabled={!canGenerate}>{busy ? <Spinner /> : <Icon name="sparkles" />}{busy ? tr("Healthy AI بيجهّز طلبك…", "Healthy AI is working on it…") : kind === "scan" ? tr("حلّل الوجبة — 1 كريدت", "Analyse meal — 1 credit") : kind === "fridge" ? tr("اقترح ٣ أفكار — 1 كريدت", "Suggest 3 ideas — 1 credit") : tr("اطلب من Healthy AI — 1 كريدت", "Ask Healthy AI — 1 credit")}</button>
                {!canGenerate && !busy && <p className="muted text-center">{!accepted ? tr("وافق على التنبيه الصحي في ملفك أولًا.", "Accept the health disclaimer in your profile first.") : total === 0 ? tr("رصيدك خلص.", "You're out of credits.") : kind === "scan" ? tr("صوّر وجبتك أولًا.", "Take a photo of your meal first.") : kind === "fridge" ? tr("اكتب المكونات أو صوّرها أولًا.", "List the ingredients or take a photo first.") : tr("اكتب طلبك أولًا (٣ حروف على الأقل).", "Type your request first (at least 3 characters).")}</p>}
              </>
            )}
            {kind === "chat" && !accepted && <p className="muted text-center">{tr("وافق على التنبيه الصحي في ملفك أولًا.", "Accept the health disclaimer in your profile first.")}</p>}
          </section>

          {recent && recent.length > 0 && (
            <section className="space-y-2" aria-label={tr("آخر نتائجي", "My latest results")}>
              <div className="flex items-center justify-between"><h2 className="font-extrabold">{tr("آخر نتائجي", "My latest results")}</h2><button className="btn-ghost btn-sm" onClick={() => setView("mine")}>{tr("عرض الكل", "View all")}</button></div>
              {recent.map((r) => (
                <Link key={r.id} href={`/chef?recipe=${r.id}`} className="card-row !min-h-14 hover:shadow-md">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name={r.content.kind === "workout" ? "bolt" : r.content.kind === "challenge" ? "flame" : r.content.kind === "scan" ? "camera" : "utensils"} size={20} /></span>
                  <p className="min-w-0 flex-1 truncate font-extrabold">{r.title}</p>
                </Link>
              ))}
            </section>
          )}
          <DisclaimerBanner conditions={me?.profile.conditions} compact />
        </>
        )
      )}
      {camOpen && (
        <CameraCapture
          onCapture={(d) => { setPhoto(d); setCamOpen(false); }}
          onClose={() => setCamOpen(false)}
          onUnavailable={() => { setCamOpen(false); toast(tr("الكاميرا الداخلية غير متاحة هنا، هنفتح كاميرا الجهاز.", "In-app camera isn't available here; opening your device camera."), "ok"); setTimeout(() => nativeCamRef.current?.click(), 200); }}
        />
      )}
    </div>
  );
}
export default function ChefPage() { return <Gate needVerified><Suspense fallback={<PageSkeleton />}><ChefInner /></Suspense></Gate>; }
