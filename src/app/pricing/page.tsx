"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { inPiContext } from "@/lib/pi-client";
import { useApp } from "@/components/AppProvider";
import { PricingGrid, type PriceItem } from "@/components/Pricing";
import { CreditBalance, PaySheet } from "@/components/Domain";
import { Notice, PageHeader, Tabs } from "@/components/ui";
import { WalletHistory } from "@/components/WalletHistory";

export default function PricingPage() {
  const { tr, me, ready, refresh, signIn, signingIn } = useApp();
  const [data, setData] = useState<{ items: PriceItem[]; trialCredits: number; network: string; rate?: { usdPerPi: number; source: string; mode: string } } | null>(null);
  const [buy, setBuy] = useState<PriceItem | null>(null);
  const [expires, setExpires] = useState<string | null>(null);
  useEffect(() => { api<typeof data>("/pricing").then(setData).catch(() => {}); }, []);
  useEffect(() => { if (me) api<{ subscription: { expires_at: string } | null }>("/wallet").then((w) => setExpires(w.subscription?.expires_at ?? null)).catch(() => {}); }, [me]);
  // Arrived from another browser via "Continue in Pi Browser": sign in if needed, then open the chosen purchase ONCE.
  const [handoff, setHandoff] = useState<{ item: string; fromOther: boolean } | null>(null);
  const [paid, setPaid] = useState(false);
  const [tab, setTab] = useState<"packs" | "history">("packs");
  useEffect(() => { if (new URLSearchParams(window.location.search).get("tab") === "history") setTab("history"); }, []);
  const signInStarted = useRef(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const item = q.get("buy");
    if (item) setHandoff({ item, fromOther: q.get("handoff") === "1" });
  }, []);
  useEffect(() => {
    if (!handoff || !ready || !data) return;
    if (!me) {
      if (inPiContext() && !signInStarted.current) { signInStarted.current = true; signIn(); }
      return;
    }
    const it = data.items.find((i) => i.key === handoff.item);
    if (it && !(it.kind === "plan" && me.balances?.planActive)) setBuy(it);
    history.replaceState(null, "", handoff.fromOther ? "/pricing?handoff=1" : "/pricing");
    setHandoff(null); // consumed: this effect must never run again for it (a re-set here caused an endless loop)
  }, [handoff, ready, data, me, signIn]);
  const verified = !!me?.profile.kyc_verified;
  const planActive = !!me?.balances?.planActive;
  const planLoaded = !!me?.balances; // until the balances arrive we show a neutral placeholder, never "Not active"
  const expiresAt = expires ?? me?.balances?.planExpiresAt ?? null;

  return (
    <div className="mx-auto max-w-6xl py-6">
      <PageHeader title={tr("الكريدت والباقات", "Credits & plans")} sub={tr("ادفع بـ Pi مرة واحدة، وتتفعّل الخدمة فور التحقق من الدفع على الخادم.", "Pay once with Pi; the service activates as soon as the server verifies the payment.")} />
      {data?.network === "testnet" && <div className="mb-4"><Notice tone="info">{tr("التطبيق الآن على شبكة Pi التجريبية (Testnet): المدفوعات بعملة Pi التجريبية.", "The app is on the Pi Testnet: payments use Test Pi.")}</Notice></div>}
      {me && (
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          {me.balances ? <CreditBalance b={me.balances} /> : verified ? <div className="card h-28 animate-pulse bg-brand-50" aria-label={tr("جارٍ التحميل", "Loading")} /> : null}
          <div className="card flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-extrabold text-ink-soft">{tr("الخطة الشهرية", "Monthly plan")}</p>
              {!planLoaded ? <span className="block h-7 w-40 animate-pulse rounded-lg bg-brand-100" aria-label={tr("جارٍ التحميل", "Loading")} /> : <p className="text-lg font-extrabold">{planActive && expiresAt ? tr(`فعّالة حتى ${new Date(expiresAt).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })}`, `Active until ${new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`) : tr("غير مفعّلة", "Not active")}</p>}
              {planActive && <p className="muted">{tr("لا يوجد تجديد تلقائي. يفتح زر التجديد عند انتهاء الـ ٣٠ يومًا.", "No auto-renewal. The renew button opens when the 30 days end.")}</p>}
            </div>
          </div>
        </div>
      )}
      {me && <Tabs label={tr("القسم", "Section")} value={tab} onChange={setTab} tabs={[["packs", tr("الباقات", "Plans & packs")], ["history", tr("سجل المدفوعات", "Payment history")]] as const} />}
      {(tab === "packs" || !me) && (
        <>
      {me && !verified && <div className="mb-4"><Notice tone="warn" icon="shieldCheck">{tr("الشراء متاح لحسابات Pi الموثقة (KYC) فقط. أكمل التوثيق في تطبيق Pi ثم سجّل الدخول مرة أخرى.", "Purchases are for KYC-verified Pi accounts only. Complete KYC in the Pi app, then sign in again.")}</Notice></div>}
      {data && (
        <PricingGrid
          items={data.items}
          trial={data.trialCredits}
          locked={signingIn || (!!me && !verified)}
          lockedKeys={planActive ? ["plan_monthly"] : []}
          lockedNote={() => (expiresAt ? tr(`التجديد متاح بعد ${new Date(expiresAt).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })}`, `Renewal opens on ${new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`) : "")}
          onBuy={(i) => (me ? setBuy(i) : signIn())}
          buyLabel={(i) => (!me ? tr("سجّل الدخول للشراء", "Sign in to buy") : i.kind === "plan" ? (planActive ? tr("الخطة فعّالة", "Plan active") : expiresAt ? tr("تجديد الخطة", "Renew plan") : tr("اشترك الآن", "Subscribe")) : tr("اشترِ الباقة", "Buy pack"))}
        />
      )}
      {paid && new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("handoff") === "1" && <div className="mt-4"><Notice tone="ok">{tr("تم الدفع. ارجع إلى المتصفح الذي كنت فيه وسيظهر رصيدك المحدّث تلقائيًا.", "Payment complete. Go back to the browser you came from and your updated balance will appear automatically.")}</Notice></div>}
        </>
      )}
      {tab === "history" && me && <WalletHistory />}
      <PaySheet item={buy} onClose={() => setBuy(null)} onPaid={() => { setPaid(true); refresh(); api<{ subscription: { expires_at: string } | null }>("/wallet").then((w) => setExpires(w.subscription?.expires_at ?? null)).catch(() => {}); }} />
    </div>
  );
}
