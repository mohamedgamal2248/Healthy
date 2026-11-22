"use client";
import Link from "next/link";
import { useGet } from "@/lib/useGet";
import { useApp, type Balances } from "@/components/AppProvider";
import { EmptyState, Gate, Notice, PageHeader, PageSkeleton } from "@/components/ui";
import { CreditBalance, ITEM_COPY } from "@/components/Domain";
import { Icon } from "@/components/Icon";

type W = { purchases: { id: string; kind: string; item_key: keyof typeof ITEM_COPY; amount_pi: number; status: string; fail_reason: string | null; txid: string | null; created_at: string }[]; balances: Balances; subscription: { expires_at: string } | null };
const STATUS: Record<string, [string, string, string]> = {
  completed: ["مكتملة", "Completed", "bg-brand-100 text-brand-800"],
  pending: ["قيد الانتظار", "Pending", "bg-sun-100 text-sun-600"],
  approved: ["قيد التأكيد", "Confirming", "bg-sky-100 text-sky-600"],
  failed: ["فشلت", "Failed", "bg-rose-100 text-rose-600"],
  cancelled: ["أُلغيت", "Cancelled", "bg-slate-100 text-slate-600"],
};

function Inner() {
  const { tr, lang, toast, errMsg } = useApp();
  const { data: w } = useGet<W>("/wallet", (e) => toast(errMsg(e), "err"));
  if (!w) return <PageSkeleton />;
  const loc = tr("ar-EG", "en-GB");
  const active = w.subscription && new Date(w.subscription.expires_at).getTime() > Date.now();
  return (
    <div className="mx-auto max-w-3xl space-y-5 py-5">
      <PageHeader title={tr("المحفظة", "Wallet")} sub={tr("مدفوعاتك وأرصدتك", "Your payments and balances")} />
      <div className="grid gap-3 md:grid-cols-2">
        <CreditBalance b={w.balances} />
        <div className="card space-y-1">
          <p className="text-sm font-extrabold text-ink-soft">{tr("الخطة الشهرية", "Monthly plan")}</p>
          {w.subscription ? (<>
            <p className="text-lg font-extrabold">{active ? tr("فعّالة", "Active") : tr("منتهية", "Expired")}</p>
            <p className="muted">{tr("تنتهي في", "Ends on")} <b className="text-ink">{new Date(w.subscription.expires_at).toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric" })}</b></p>
          </>) : <p className="text-lg font-extrabold">{tr("غير مشترك", "No plan")}</p>}
          <p className="muted">{tr("لا تجديد تلقائي: التجديد دفعة جديدة تتم يدويًا.", "No auto-renewal: renewing is a new manual payment.")}</p>
          <Link href="/pricing" className="btn-soft btn-sm mt-2">{active ? tr("تجديد الخطة", "Renew plan") : tr("الأسعار والباقات", "Plans and packs")}</Link>
        </div>
      </div>
      <section>
        <h2 className="h2 mb-3">{tr("سجل المدفوعات", "Payment history")}</h2>
        {w.purchases.length === 0 ? <EmptyState icon="receipt" title={tr("لا توجد مدفوعات", "No payments yet")} /> : (
          <ul className="space-y-2.5">{w.purchases.map((p) => {
            const st = STATUS[p.status] ?? STATUS.pending;
            return (
              <li key={p.id} className="card space-y-2 !p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Icon name={ITEM_COPY[p.item_key]?.icon ?? "receipt"} size={22} /></span>
                  <div className="min-w-0 flex-1"><p className="font-extrabold">{ITEM_COPY[p.item_key] ? tr(ITEM_COPY[p.item_key].ar, ITEM_COPY[p.item_key].en) : p.item_key}</p><p className="muted">{new Date(p.created_at).toLocaleString(loc, { dateStyle: "medium", timeStyle: "short" })}</p></div>
                  <div className="text-end"><p className="font-extrabold tabular-nums">{Number(p.amount_pi)} Pi</p><span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${st[2]}`}>{lang === "ar" ? st[0] : st[1]}</span></div>
                </div>
                {p.txid && <p className="break-all rounded-xl bg-canvas p-2 text-xs font-semibold text-ink-soft" dir="ltr"><span className="font-extrabold">TXID </span>{p.txid}</p>}
                {(p.status === "failed" || p.status === "cancelled") && <Notice tone="bad">{tr("لم يتم منح أي شيء. يمكنك المحاولة بشراء جديد.", "Nothing was granted. You can retry with a new purchase.")}{p.fail_reason ? ` (${p.fail_reason})` : ""}</Notice>}
              </li>);
          })}</ul>
        )}
      </section>
    </div>
  );
}
export default function WalletPage() { return <Gate><Inner /></Gate>; }
