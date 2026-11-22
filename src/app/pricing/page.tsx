"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/components/AppProvider";
import { PricingGrid, type PriceItem } from "@/components/Pricing";
import { CreditBalance, PaySheet } from "@/components/Domain";
import { Notice, PageHeader } from "@/components/ui";

export default function PricingPage() {
  const { tr, me, refresh, signIn, signingIn } = useApp();
  const [data, setData] = useState<{ items: PriceItem[]; trialCredits: number; network: string; rate?: { usdPerPi: number; source: string; mode: string } } | null>(null);
  const [buy, setBuy] = useState<PriceItem | null>(null);
  const [expires, setExpires] = useState<string | null>(null);
  useEffect(() => { api<typeof data>("/pricing").then(setData).catch(() => {}); }, []);
  useEffect(() => { if (me) api<{ subscription: { expires_at: string } | null }>("/wallet").then((w) => setExpires(w.subscription?.expires_at ?? null)).catch(() => {}); }, [me]);
  const verified = !!me?.profile.kyc_verified;
  const planActive = !!me?.balances?.planActive;

  return (
    <div className="mx-auto max-w-6xl py-6">
      <PageHeader title={tr("الأسعار والباقات", "Pricing and packs")} sub={tr("ادفع بـ Pi مرة واحدة، وتتفعّل الخدمة فور التحقق من الدفع على الخادم.", "Pay once with Pi; the service activates as soon as the server verifies the payment.")} />
      {data?.network !== "mainnet" && <div className="mb-4"><Notice tone="info">{tr("التطبيق الآن على شبكة Pi التجريبية (Testnet): المدفوعات بعملة Pi التجريبية.", "The app is on the Pi Testnet: payments use Test Pi.")}</Notice></div>}
      {data?.rate && <div className="mb-4"><Notice tone="ok" icon="coin">{tr(`الأسعار بالدولار وتتحوّل لـ Pi بسعر اللحظة من OKX: 1 Pi ≈ ${data.rate.usdPerPi.toFixed(4)} دولار، مقرّبة لأعلى لرقم صحيح. السعر يتثبت ٣٠ دقيقة عند الشراء.`, `Prices are set in USD and converted to Pi at the live OKX rate: 1 Pi ≈ $${data.rate.usdPerPi.toFixed(4)}, rounded up to a whole Pi. The price locks for 30 minutes at purchase.`)}</Notice></div>}
      {me && (
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          <CreditBalance b={me.balances} />
          <div className="card flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-extrabold text-ink-soft">{tr("الخطة الشهرية", "Monthly plan")}</p>
              <p className="text-lg font-extrabold">{planActive && expires ? tr(`فعّالة حتى ${new Date(expires).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })}`, `Active until ${new Date(expires).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`) : tr("غير مفعّلة", "Not active")}</p>
              {planActive && <p className="muted">{tr("لا يوجد تجديد تلقائي: اضغط تجديد قبل الانتهاء أو بعده.", "No auto-renewal: renew manually before or after it ends.")}</p>}
            </div>
          </div>
        </div>
      )}
      {me && !verified && <div className="mb-4"><Notice tone="warn" icon="shieldCheck">{tr("الشراء متاح لحسابات Pi الموثقة (KYC) فقط. أكمل التوثيق في تطبيق Pi ثم سجّل الدخول مرة أخرى.", "Purchases are for KYC-verified Pi accounts only. Complete KYC in the Pi app, then sign in again.")}</Notice></div>}
      {data && (
        <PricingGrid
          items={data.items}
          trial={data.trialCredits}
          locked={signingIn || (!!me && !verified)}
          onBuy={(i) => (me ? setBuy(i) : signIn())}
          buyLabel={(i) => (!me ? tr("سجّل الدخول للشراء", "Sign in to buy") : i.kind === "plan" ? (planActive ? tr("تجديد الخطة", "Renew plan") : tr("اشترك الآن", "Subscribe")) : tr("اشترِ الباقة", "Buy pack"))}
        />
      )}
      <PaySheet item={buy} onClose={() => setBuy(null)} onPaid={() => { refresh(); api<{ subscription: { expires_at: string } | null }>("/wallet").then((w) => setExpires(w.subscription?.expires_at ?? null)).catch(() => {}); }} />
    </div>
  );
}
