"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { PINET_URL } from "@/config/pi";
import { useGet } from "@/lib/useGet";
import { useApp } from "@/components/AppProvider";
import { EmptyState, Gate, Notice, PageHeader, PageSkeleton, Spinner, VerifiedBadge } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { DuoSection } from "@/components/DuoSection";

type Pub = {
  group: { title_ar: string; title_en: string; week_start: string };
  board: Row[];
  topRecipes: PR[]; latestRecipes: PR[]; monthBoard: Row[]; teams: { key: string; ar: string; en: string; members: number; days: number }[]; stats: { members: number; checkedToday: number };
};
type Mine = { joined: boolean; myDays: number; checkedToday: boolean; hidden: boolean; myTeam: string; likedIds: string[]; savedIds: string[] };
type PR = { id: string; title: string; author: string; calories?: number; protein?: number; likes: number; saves: number };
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
      <section className="overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-sun-500 to-sun-600 p-5 text-white shadow-(--shadow-card)">
        <p className="flex items-center gap-2 text-sm font-extrabold text-sun-100"><Icon name="users" size={18} />{tr("تحدي الأسبوع الجماعي", "This week's group challenge")}</p>
        <h2 className="mt-1 text-2xl font-extrabold leading-snug">{lang === "ar" ? d.group.title_ar : d.group.title_en}</h2>
        <p className="mt-1 text-sm font-bold text-sun-100">{tr(`${d.stats.members} بايونير انضموا · ${d.stats.checkedToday} سجّلوا اليوم`, `${d.stats.members} pioneers joined · ${d.stats.checkedToday} checked in today`)}{myRank ? tr(` · ترتيبك ${myRank}`, ` · your rank ${myRank}`) : ""}</p>
        {d.joined ? (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1"><div className="h-3 overflow-hidden rounded-full bg-white/30"><div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, (d.myDays / 7) * 100)}%` }} /></div><p className="mt-1 text-sm font-bold">{d.myDays}/7 {tr("أيام", "days")}</p></div>
            <button className="btn !bg-white !text-sun-600" disabled={busy || d.checkedToday} onClick={() => act("/community/checkin")}>{busy ? <Spinner size={18} /> : <Icon name="check" />}{d.checkedToday ? tr("تم اليوم", "Done today") : tr("سجّل اليوم", "Check in today")}</button>
          </div>
        ) : (
          <button className="btn mt-4 !bg-white !text-sun-600" disabled={busy} onClick={() => act("/community/join")}>{busy ? <Spinner size={18} /> : <Icon name="plus" />}{tr("انضم بضغطة واحدة", "Join with one tap")}</button>
        )}
        <button className="btn mt-3 w-full !bg-white/20 !text-white" onClick={invite}><Icon name="share" size={18} />{tr("ادعُ أصحابك للتحدي", "Invite friends to the challenge")}</button>
        <p className="mt-2 text-xs font-bold text-sun-100">{tr("كل صديق جديد يكمّل أول تحدٍّ: طلب AI مجاني لك وله (حتى ١٠ دعوات).", "Each new friend who completes a first challenge: a free AI request for you both (up to 10 invites).")}</p>
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

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="h2">{tr("المتصدرون من البايونيرز الموثقين", "Verified Pioneers leaderboard")}</h2>
          <div className="flex gap-1.5">{([["week", tr("الأسبوع", "Week")], ["month", tr("الشهر", "Month")]] as const).map(([k, l]) => (<button key={k} className="chip" aria-pressed={btab === k} onClick={() => setBtab(k)}>{l}</button>))}</div>
        </div>
        {(btab === "week" ? d.board : d.monthBoard).length === 0 ? <EmptyState icon="trophy" title={tr("كن أول المتصدرين", "Be the first on the board")} body={tr("انضم وسجّل يومك لتظهر هنا.", "Join and check in to appear here.")} /> : (
          <ol className="space-y-2">{(btab === "week" ? d.board : d.monthBoard).map((r) => (
            <li key={r.username} className={`card flex items-center gap-3 !p-3 ${r.username === me?.profile.username ? "!border-brand-400 !bg-brand-50" : ""}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-extrabold tabular-nums ${medal[r.rank - 1] ?? "bg-canvas text-ink-soft"}`}>{r.rank}</span>
              <div className="min-w-0 flex-1"><p className="truncate font-extrabold"><bdi dir="ltr">@{r.username}</bdi></p><div className="mt-0.5 flex items-center gap-2"><VerifiedBadge small />{btab === "week" && <span className="inline-flex items-center gap-1 text-xs font-bold text-ink-soft"><Icon name="flame" size={13} className="text-sun-500" />{r.streak}</span>}</div></div>
              <p className="text-end"><span className="block text-xl font-extrabold tabular-nums">{r.days}</span><span className="text-xs font-bold text-ink-soft">{tr("يوم", "days")}</span></p>
            </li>))}</ol>
        )}
      </section>

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
      </section>
    </div>
  );
}
export default function CommunityPage() { return <Gate needVerified><Inner /></Gate>; }
