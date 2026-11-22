"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/components/AppProvider";
import { EmptyState, Gate, Notice, PageHeader, PageSkeleton, Spinner, VerifiedBadge } from "@/components/ui";
import { Icon } from "@/components/Icon";

type C = {
  group: { title_ar: string; title_en: string; week_start: string }; joined: boolean; myDays: number; checkedToday: boolean; hidden: boolean;
  board: { rank: number; username: string; days: number; streak: number }[];
  topRecipes: { id: string; title: string; author: string; calories?: number; protein?: number; likes: number; saves: number; liked: boolean; saved: boolean }[];
};

function Inner() {
  const { tr, lang, me, toast, errMsg } = useApp();
  const [d, setD] = useState<C | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api<C>("/community").then(setD).catch((e) => toast(errMsg(e), "err")), [toast, errMsg]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <PageSkeleton />;
  const act = async (path: string) => { setBusy(true); try { await api(path, { body: {} }); await load(); } catch (e) { toast(errMsg(e), "err"); } finally { setBusy(false); } };
  const like = async (id: string) => { try { await api(`/recipes/${id}/like`, { body: {} }); load(); } catch (e) { toast(errMsg(e), "err"); } };
  const save = async (id: string) => { try { await api("/favourites", { body: { type: "recipe", id } }); load(); } catch (e) { toast(errMsg(e), "err"); } };
  const medal = ["bg-sun-400 text-white", "bg-slate-300 text-ink", "bg-amber-700/80 text-white"];

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-5">
      <PageHeader title={tr("المجتمع", "Community")} sub={tr("ترتيب وشارات فقط. لا رسوم ولا جوائز بعملة Pi.", "Ranking and badges only. No fees and no Pi prizes.")} />
      <section className="overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-sun-500 to-sun-600 p-5 text-white shadow-(--shadow-card)">
        <p className="flex items-center gap-2 text-sm font-extrabold text-sun-100"><Icon name="users" size={18} />{tr("تحدي الأسبوع الجماعي", "This week's group challenge")}</p>
        <h2 className="mt-1 text-2xl font-extrabold leading-snug">{lang === "ar" ? d.group.title_ar : d.group.title_en}</h2>
        {d.joined ? (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1"><div className="h-3 overflow-hidden rounded-full bg-white/30"><div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, (d.myDays / 7) * 100)}%` }} /></div><p className="mt-1 text-sm font-bold">{d.myDays}/7 {tr("أيام", "days")}</p></div>
            <button className="btn !bg-white !text-sun-600" disabled={busy || d.checkedToday} onClick={() => act("/community/checkin")}>{busy ? <Spinner size={18} /> : <Icon name="check" />}{d.checkedToday ? tr("تم اليوم", "Done today") : tr("سجّل اليوم", "Check in today")}</button>
          </div>
        ) : (
          <button className="btn mt-4 !bg-white !text-sun-600" disabled={busy} onClick={() => act("/community/join")}>{busy ? <Spinner size={18} /> : <Icon name="plus" />}{tr("انضم بضغطة واحدة", "Join with one tap")}</button>
        )}
      </section>
      {d.hidden && <Notice tone="info" icon="eyeOff">{tr("أنت مخفي من لوحة المتصدرين (من الملف الشخصي).", "You are hidden from the leaderboard (set in your profile).")}</Notice>}

      <section>
        <h2 className="h2 mb-3">{tr("المتصدرون من البايونيرز الموثقين", "Leaderboard of verified Pioneers")}</h2>
        {d.board.length === 0 ? <EmptyState icon="trophy" title={tr("كن أول المتصدرين", "Be the first on the board")} body={tr("انضم وسجّل يومك لتظهر هنا.", "Join and check in to appear here.")} /> : (
          <ol className="space-y-2">{d.board.map((r) => (
            <li key={r.username} className={`card flex items-center gap-3 !p-3 ${r.username === me?.profile.username ? "!border-brand-400 !bg-brand-50" : ""}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-extrabold tabular-nums ${medal[r.rank - 1] ?? "bg-canvas text-ink-soft"}`}>{r.rank}</span>
              <div className="min-w-0 flex-1"><p className="truncate font-extrabold">@{r.username}</p><div className="mt-0.5 flex items-center gap-2"><VerifiedBadge small /><span className="inline-flex items-center gap-1 text-xs font-bold text-ink-soft"><Icon name="flame" size={13} className="text-sun-500" />{r.streak}</span></div></div>
              <p className="text-end"><span className="block text-xl font-extrabold tabular-nums">{r.days}</span><span className="text-xs font-bold text-ink-soft">{tr("يوم", "days")}</span></p>
            </li>))}</ol>
        )}
      </section>

      <section>
        <h2 className="h2 mb-3">{tr("أفضل الوصفات هذا الأسبوع", "Top recipes this week")}</h2>
        {d.topRecipes.length === 0 ? <EmptyState icon="chef" title={tr("لا وصفات بعد", "No recipes yet")} body={tr("شارك وصفة من الشيف AI وسيظهر الإعجاب والحفظ هنا.", "Share an AI Chef recipe and its likes and saves will show up here.")} /> : (
          <ul className="space-y-2.5">{d.topRecipes.map((r) => (
            <li key={r.id} className="card flex items-center gap-3 !p-3.5">
              <a href={`/r/${r.id}`} className="min-w-0 flex-1"><p className="truncate font-extrabold">{r.title}</p><p className="muted flex items-center gap-2">@{r.author}<VerifiedBadge small /></p></a>
              <button className="btn-ghost btn-sm !px-2.5" onClick={() => like(r.id)} aria-pressed={r.liked} aria-label={tr("إعجاب", "Like")}><Icon name="heart" size={20} filled={r.liked} className={r.liked ? "text-rose-600" : ""} /><span className="tabular-nums">{r.likes}</span></button>
              <button className="btn-ghost btn-sm !px-2.5" onClick={() => save(r.id)} aria-pressed={r.saved} aria-label={tr("حفظ", "Save")}><Icon name="book" size={20} filled={r.saved} className={r.saved ? "text-brand-600" : ""} /><span className="tabular-nums">{r.saves}</span></button>
            </li>))}</ul>
        )}
      </section>
    </div>
  );
}
export default function CommunityPage() { return <Gate needVerified><Inner /></Gate>; }
