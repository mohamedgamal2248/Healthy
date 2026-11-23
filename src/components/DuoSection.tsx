"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useGet } from "@/lib/useGet";
import { PINET_URL } from "@/config/pi";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { Spinner } from "./ui";

type Duo = { id: string; code?: string; partner: string | null; startDate: string; endDate: string; finished: boolean; mine: number; theirs: number; total: number };

/** 7-day challenge with a friend: invite by link, both see each other's number of days. */
export function DuoSection() {
  const { tr, toast, errMsg } = useApp();
  const { data, reload } = useGet<{ duos: Duo[] }>("/duo", (e) => toast(errMsg(e), "err"));
  const [busy, setBusy] = useState(false);
  const invite = async () => {
    setBusy(true);
    try {
      const { code } = await api<{ code: string }>("/duo", { body: {} });
      const url = `${PINET_URL}/?duo=${code}`;
      const text = tr("تعال نكمل تحدي ٧ أيام مع بعض على Healthy", "Join me for a 7-day challenge on Healthy");
      try { if (navigator.share) await navigator.share({ title: "Healthy", text, url }); else { await navigator.clipboard.writeText(`${text} ${url}`); toast(tr("تم نسخ رابط الدعوة", "Invite link copied"), "ok"); } } catch { /* share sheet dismissed */ }
      reload();
    } catch (e) { toast(errMsg(e), "err"); } finally { setBusy(false); }
  };
  const copy = async (code: string) => { try { await navigator.clipboard.writeText(`${PINET_URL}/?duo=${code}`); toast(tr("تم نسخ رابط الدعوة", "Invite link copied"), "ok"); } catch { /* ignore */ } };
  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between gap-3"><h2 className="h2">{tr("تحدي مع صديق", "Challenge a friend")}</h2></div>
      <p className="muted">{tr("٧ أيام، كلاكما يُنجز تحديًا يوميًا، وتشوفون تقدّم بعض.", "7 days, you both do a daily challenge and see each other's progress.")}</p>
      {(data?.duos ?? []).map((d) => (
        <div key={d.id} className="rounded-2xl bg-brand-50 p-3">
          {d.partner ? (
            <>
              <p className="flex items-center justify-between font-extrabold"><bdi dir="ltr">@{d.partner}</bdi><span className="text-xs font-bold text-ink-soft">{d.finished ? tr("انتهى", "Finished") : `${d.startDate.slice(5)} – ${d.endDate.slice(5)}`}</span></p>
              {[[tr("أنت", "You"), d.mine], [tr("صديقك", "Friend"), d.theirs]].map(([l, n]) => (
                <div key={l as string} className="mt-2"><div className="flex justify-between text-sm font-bold"><span>{l}</span><span className="tabular-nums">{n as number}/{d.total}</span></div><div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-brand-600" style={{ width: `${((n as number) / d.total) * 100}%` }} /></div></div>
              ))}
            </>
          ) : (
            <div className="flex items-center justify-between gap-3"><p className="font-bold">{tr("في انتظار صديقك…", "Waiting for your friend…")}</p>{d.code && <button className="btn-ghost btn-sm" onClick={() => copy(d.code!)}><Icon name="copy" size={16} />{tr("انسخ الرابط", "Copy link")}</button>}</div>
          )}
        </div>
      ))}
      <button className="btn-primary w-full" onClick={invite} disabled={busy}>{busy ? <Spinner size={18} /> : <Icon name="users" size={18} />}{tr("ادعُ صديقًا لتحدي ٧ أيام", "Invite a friend to a 7-day challenge")}</button>
    </section>
  );
}
