"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { PINET_URL } from "@/config/pi";
import { useGet } from "@/lib/useGet";
import { useApp } from "@/components/AppProvider";
import { EmptyState, Gate, Notice, PageHeader, PageSkeleton, Spinner, Tabs, VerifiedBadge } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { DuoSection } from "@/components/DuoSection";

type Pub = {
  group: { title_ar: string; title_en: string; week_start: string };
  board: Row[];
  topRecipes: PR[]; latestRecipes: PR[]; monthBoard: Row[]; teams: { key: string; ar: string; en: string; members: number; days: number }[]; stats: { members: number; checkedToday: number };
  examples?: { id: string; name_ar: string; name_en: string; calories: number; protein_g: number; time_min: number }[];
};
type Mine = { joined: boolean; myDays: number; checkedToday: boolean; hidden: boolean; myTeam: string; likedIds: string[]; savedIds: string[] };
type PR = { id: string; title: string; author: string; calories?: number; protein?: number; likes: number; saves: number };
/** Below this many members, counts and ranks are hidden: they say little and make a new group look empty. */
const SMALL_GROUP = 5;
type Row = { rank: number; username: string; days: number; streak: number };
type R = PR & { liked: boolean; saved: boolean };

function Inner() {
  const { tr, lang, me, toast, errMsg } = useApp();
  // Public part: same for everyone, served from the CDN. Private part: my participation, likes and saves.
  const { data: pub, reload: reloadPub } = useGet<Pub>("/public/community", (e) => toast(errMsg(e), "err"), { anon: true });
  const { data: mine, reload: load } = useGet<Mine>("/community/me", (e) => toast(errMsg(e), "err"));
  // Likes / saves change immediately on screen; the cached public counters catch up within a minute.
  const [ov, setOv] = useState<Record<string, { liked?: boolean; likes?: number; saved?: boolean; saves?: number }>>({});
  const [busy, setBusy] = useState(false);
  const [btab, setBtab] = useState<"week" | "month">("week");
  const [rtab, setRtab] = useState<"top" | "new">("top");
  const [ctab, setCtab] = useState<"challenge" | "board" | "recipes">("challenge");
  if (!pub || !mine) return <PageSkeleton />;
  const withMine = (r: PR): R => ({ ...r, liked: mine.likedIds.includes(r.id), saved: mine.savedIds.includes(r.id), ...ov[r.id] });
  const d = { ...pub, ...mine, topRecipes: pub.topRecipes.map(withMine), latestRecipes: pub.latestRecipes.map(withMine) };
  const act = async (path: string) => { setBusy(true); try { await api(path, { body: {} }); await Promise.all([load(), reloadPub()]); } catch (e) { toast(errMsg(e), "err"); } finally { setBusy(false); } };
  const like = async (id: string) => { try { const r = await api<{ liked: boolean; likes: number }>(`/recipes/${id}/like`, { body: {} }); setOv((o) => ({ ...o, [id]: { ...o[id], liked: r.liked, likes: r.likes } })); } catch (e) { toast(errMsg(e), "err"); } };
  const save = async (id: string) => { try { const r = await api<{ favourite: boolean }>("/favourites", { body: { type: "recipe", id } }); const base = [...d.topRecipes, ...d.latestRecipes].find((x) => x.id === id); setOv((o) => ({ ...o, [id]: { ...o[id], saved: r.favourite, saves: Math.max(0, (base?.saves ?? 0) + (r.favourite === !!base?.saved ? 0 : r.favourite ? 1 : -1)) } })); } catch (e) { toast(errMsg(e), "err"); } };
  const invite = async () => {
    const url = `${PINET_URL}/?ref=${encodeURIComponent(me?.profile.username ?? "")}`;
    const text = tr(`انضم لتحدي الأسبوع معايا على Healthy: ${lang === "ar" ? d.group.title_ar : d.group.title_en}`, `Join this week's challenge with me on Healthy: ${d.group.title_en}`);
    try {
      if (navigator.share) await navigator.share({ title: "Healthy", text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); toast(tr("تم نسخ رابط الدعوة", "Invite link copied"), "ok"); }
    } catch { /* cancelled */ }
  };
  const myRank = d.board.find((r) => r.username === me?.profile.username)?.rank;
  const medal = ["bg-sun-400 text-white", "bg-slate-300 text-ink", "bg-amber-700/80 text-white"];

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-5">
      <PageHeader title={tr("المجتمع", "Community")} sub={tr("ترتيب وشارات فقط. لا رسوم ولا جوائز بعملة Pi.", "Ranking and badges only. No fees and no Pi prizes.")} />
      <Tabs label={tr("القسم", "Section")} value={ctab} onChange={setCtab} tabs={[["challenge", tr("التحدي", "Challenge")], ["board", tr("المتصدرون", "Leaderboard")], ["recipes", tr("الوصفات", "Recipes")]] as const} />
      {ctab === "challenge" && <>
      <section className="overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-sun-500 to-sun-600 p-5 text-white shadow-(--shadow-card)">
        <p className="flex items-center gap-2 text-sm font-extrabold text-sun-100"><Icon name="users" size={18} />{tr("تحدي الأسبوع الجماعي", "This week's group challenge")}</p>
        <h2 className="mt-1 text-2xl font-extrabold leading-snug">{lang === "ar" ? d.group.title_ar : d.group.title_en}</h2>
        <p className="mt-1 text-sm font-bold text-sun-100">{d.stats.members >= SMALL_GROUP ? <>{tr(`${d.stats.members} بايونير انضموا · ${d.stats.checkedToday} سجّلوا اليوم`, `${d.stats.members} pioneers joined · ${d.stats.checkedToday} checked in today`)}{myRank ? tr(` · ترتيبك ${myRank}`, ` · your rank ${myRank}`) : ""}</> : tr("تحدي الأسبوع لكل البايونيرز: انضم وادعُ أصحابك.", "This week's challenge for every Pioneer: join and invite your friends.")}</p>
        {d.joined ? (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1"><div className="h-3 overflow-hidden rounded-full bg-white/30"><div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, (d.myDays / 7) * 100)}%` }} /></div><p className="mt-1 text-sm font-bold">{d.myDays}/7 {tr("أيام", "days")}</p></div>
            <button className="btn !bg-white !text-sun-600" disabled={busy || d.checkedToday} onClick={() => act("/community/checkin")}>{busy ? <Spinner size={18} /> : <Icon name="check" />}{d.checkedToday ? tr("تم اليوم", "Done today") : tr("سجّل اليوم", "Check in today")}</button>
          </div>
        ) : (
          <button className="btn mt-4 !bg-white !text-sun-600" disabled={busy} onClick={() => act("/community/join")}>{busy ? <Spinner size={18} /> : <Icon name="plus" />}{tr("انضم بضغطة واحدة", "Join with one tap")}</button>
        )}
        <button className="btn mt-3 w-full !bg-white/20 !text-white" onClick={invite}><Icon name="share" size={18} />{tr("ادعُ أصحابك للتحدي", "Invite friends to the challenge")}</button>
        <p className="mt-2 text-xs font-bold text-sun-100">{tr("كل صديق جديد ينجز تحديات ٣ أيام متتالية: طلب AI مجاني لك وله (حتى ٥ دعوات).", "Each new friend who keeps a 3-day streak: a free AI request for you both (up to 5 invites).")}</p>
      </section>
      <DuoSection />
      {d.hidden && <Notice tone="info" icon="eyeOff">{tr("أنت مخفي من لوحة المتصدرين (من الملف الشخصي).", "You are hidden from the leaderboard (set in your profile).")}</Notice>}

      <section className="card !p-3.5">
        <p className="mb-2 text-sm font-extrabold text-ink-soft">{tr("الفريقان هذا الأسبوع", "Teams this week")}</p>
        <div className="grid grid-cols-2 gap-3">
          {d.teams.map((t) => (
            <div key={t.key} className={`rounded-2xl p-3 text-center ${t.key === "olive" ? "bg-brand-50" : "bg-sun-50"} ${t.key === d.myTeam ? "ring-2 ring-ink/20" : ""}`}>
              <p className="font-extrabold">{lang === "ar" ? t.ar : t.en}{t.key === d.myTeam && <span className="ms-1 text-xs text-ink-soft">({tr("فريقك", "yours")})</span>}</p>
              <p className="text-2xl font-extrabold tabular-nums">{t.days}</p>
              <p className="muted">{tr(`يوم · ${t.members} عضو`, `days · ${t.members} members`)}</p>
            </div>
          ))}
        </div>
      </section>

      </>}

      {ctab === "board" && (
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="h2">{tr("المتصدرون من البايونيرز", "Pioneers leaderboard")}</h2>
          <div className="flex gap-1.5">{([["week", tr("الأسبوع", "Week")], ["month", tr("الشهر", "Month")]] as const).map(([k, l]) => (<button key={k} className="chip" aria-pressed={btab === k} onClick={() => setBtab(k)}>{l}</button>))}</div>
        </div>
        {(btab === "week" ? d.board : d.monthBoard).length === 0 ? <EmptyState icon="trophy" title={tr("كن أول المتصدرين", "Be the first on the board")} body={tr("انضم وسجّل يومك لتظهر هنا.", "Join and check in to appear here.")} /> : (
          <>
          {(btab === "week" ? d.board : d.monthBoard).length < 5 && <Notice tone="ok" icon="trophy">{tr("المجتمع لسه في أوله، وإنت من الأوائل. أي يوم تسجّله بيحطك في المقدمة، وادعُ أصحابك من تحدي الأسبوع.", "The community is just starting and you're among the first Pioneers. Every day you check in keeps you at the top; invite friends from the weekly challenge.")}</Notice>}
          <ol className="mt-3 space-y-2">{(btab === "week" ? d.board : d.monthBoard).map((r) => (
            <li key={r.username} className={`card flex items-center gap-3 !p-3 ${r.username === me?.profile.username ? "!border-brand-400 !bg-brand-50" : ""}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-extrabold tabular-nums ${medal[r.rank - 1] ?? "bg-canvas text-ink-soft"}`}>{r.rank}</span>
              <div className="min-w-0 flex-1"><p className="truncate font-extrabold"><bdi dir="ltr">@{r.username}</bdi></p><div className="mt-0.5 flex items-center gap-2"><VerifiedBadge small />{btab === "week" && <span className="inline-flex items-center gap-1 text-xs font-bold text-ink-soft"><Icon name="flame" size={13} className="text-sun-500" />{r.streak}</span>}</div></div>
              <p className="text-end"><span className="block text-xl font-extrabold tabular-nums">{r.days}</span><span className="text-xs font-bold text-ink-soft">{tr("يوم", "days")}</span></p>
            </li>))}</ol>
          </>
        )}
      </section>

      )}

      {ctab === "recipes" && (
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="h2">{tr("وصفات المجتمع", "Community recipes")}</h2>
          <div className="flex gap-1.5">{([["top", tr("الأفضل", "Top")], ["new", tr("الأحدث", "Newest")]] as const).map(([k, l]) => (<button key={k} className="chip" aria-pressed={rtab === k} onClick={() => setRtab(k)}>{l}</button>))}</div>
        </div>
        {(rtab === "top" ? d.topRecipes : d.latestRecipes).length === 0 ? <EmptyState icon="chef" title={tr("لا وصفات بعد", "No recipes yet")} body={tr("ولّد وصفة من Healthy AI ثم اضغط «انشر في المجتمع» لتظهر هنا ويحفظها الآخرون.", "Generate a recipe with Healthy AI, then press Publish to community so others can like and save it.")} /> : (
          <ul className="space-y-2.5">{(rtab === "top" ? d.topRecipes : d.latestRecipes).map((r) => (
            <li key={r.id} className="card flex items-center gap-3 !p-3.5">
              <a href={`/r/${r.id}`} className="min-w-0 flex-1"><p className="truncate font-extrabold">{r.title}</p><p className="muted flex items-center gap-2"><bdi dir="ltr">@{r.author}</bdi><VerifiedBadge small /></p></a>
              <button className="btn-ghost btn-sm !px-2.5" onClick={() => like(r.id)} aria-pressed={r.liked} aria-label={tr("إعجاب", "Like")}><Icon name="heart" size={20} filled={r.liked} className={r.liked ? "text-rose-600" : ""} /><span className="tabular-nums">{r.likes}</span></button>
              <button className="btn-ghost btn-sm !px-2.5" onClick={() => save(r.id)} aria-pressed={r.saved} aria-label={tr("حفظ", "Save")}><Icon name="book" size={20} filled={r.saved} className={r.saved ? "text-brand-600" : ""} /><span className="tabular-nums">{r.saves}</span></button>
            </li>))}</ul>
        )}
        {(rtab === "top" ? d.topRecipes : d.latestRecipes).length < 3 && (d.examples?.length ?? 0) > 0 && (
          <div className="mt-5">
            <h3 className="mb-1 font-extrabold">{tr("أمثلة من فريق Healthy", "Examples from the Healthy team")}</h3>
            <p className="muted mb-3">{tr("دي وجبات من كتالوجنا (مش من مستخدمين). وصفاتك المنشورة هتظهر هنا مع الناس.", "These are meals from our catalogue, not from users. Recipes you publish will appear here with everyone else's.")}</p>
            <ul className="space-y-2.5">{d.examples!.map((m) => (
              <li key={m.id}><a href={`/meals/${m.id}`} className="card flex items-center gap-3 !p-3.5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Icon name="utensils" size={22} /></span><span className="min-w-0 flex-1"><span className="block truncate font-extrabold">{lang === "ar" ? m.name_ar : m.name_en}</span><span className="muted block">{m.calories} {tr("سعرة", "kcal")} · {m.protein_g} {tr("جم بروتين", "g protein")} · {m.time_min} {tr("د", "min")}</span></span><span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-extrabold text-brand-700">{tr("مثال", "Example")}</span></a></li>
            ))}</ul>
          </div>
        )}
      </section>
      )}
    </div>
  );
}
export default function CommunityPage() { return <Gate needVerified><Inner /></Gate>; }
