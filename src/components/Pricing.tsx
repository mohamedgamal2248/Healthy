"use client";
import { Icon } from "./Icon";
import { useApp } from "./AppProvider";
import { ITEM_COPY, itemBenefits } from "./Domain";

export type PriceItem = { key: "plan_monthly" | "pack_small" | "pack_large"; kind: "plan" | "pack"; pricePi: number; usd?: number; credits: number; days: number };

export function FreeTierCard({ trial }: { trial: number }) {
  const { tr } = useApp();
  const list = [
    tr("تحدي اليوم وسلسلة الأيام والشارات", "Daily challenges, streaks and badges"),
    tr("وجبات اليوم وكتالوج الوجبات بالبحث", "Meals of the day and catalogue search"),
    tr("تتبّع التقدم (الوزن والمياه والنوم والخطوات)", "Progress tracking (weight, water, sleep, steps)"),
    tr(`${trial} كريدت AI مكافأة لإنهاء تحدي البداية (٧ أيام متتالية)`, `${trial} free AI requests for finishing the 7-day starter challenge`),
  ];
  return (
    <div className="card flex flex-col">
      <p className="text-sm font-extrabold text-ink-soft">{tr("المجاني", "Free")}</p>
      <p className="mt-1 text-3xl font-extrabold">0 <span className="text-lg">Pi</span></p>
      <ul className="mt-4 flex-1 space-y-2 text-sm font-semibold">{list.map((b) => (<li key={b} className="flex gap-2"><Icon name="check" size={16} className="mt-1 shrink-0 text-brand-600" />{b}</li>))}</ul>
    </div>
  );
}

export function PricingGrid({ items, trial, onBuy, buyLabel, locked, lockedKeys = [], lockedNote }: { items: PriceItem[]; trial: number; onBuy?: (i: PriceItem) => void; buyLabel?: (i: PriceItem) => string; locked?: boolean; lockedKeys?: string[]; lockedNote?: (i: PriceItem) => string }) {
  const { tr } = useApp();
  const order: PriceItem["key"][] = ["plan_monthly", "pack_small", "pack_large"];
  const sorted = order.map((k) => items.find((i) => i.key === k)).filter(Boolean) as PriceItem[];
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <FreeTierCard trial={trial} />
      {sorted.map((i) => {
        const copy = ITEM_COPY[i.key];
        const featured = i.key === "plan_monthly";
        return (
          <div key={i.key} className={`card relative flex flex-col ${featured ? "!border-brand-500 ring-2 ring-brand-200" : ""}`}>
            {featured && <span className="absolute -top-3 start-4 rounded-full bg-brand-600 px-3 py-1 text-xs font-extrabold text-white">{tr("الأفضل قيمة", "Best value")}</span>}
            <p className="flex items-center gap-2 text-sm font-extrabold text-ink-soft"><Icon name={copy.icon} size={16} className="text-brand-600" />{tr(copy.ar, copy.en)}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">{i.pricePi} <span className="text-lg">Pi</span>{i.kind === "plan" && <span className="text-sm font-bold text-ink-soft"> / {tr("٣٠ يومًا", "30 days")}</span>}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm font-semibold">{itemBenefits(i, tr).map((b) => (<li key={b} className="flex gap-2"><Icon name="check" size={16} className="mt-1 shrink-0 text-brand-600" />{b}</li>))}</ul>
            {onBuy && (() => {
              const off = lockedKeys.includes(i.key);
              return (
                <>
                  <button className={`mt-4 w-full ${off ? "btn !bg-canvas !text-ink-soft border border-line opacity-60" : featured ? "btn-primary" : "btn-soft"}`} onClick={() => onBuy(i)} disabled={locked || off} aria-disabled={locked || off}>
                    <Icon name={off ? "lock" : "pi"} size={18} /> {buyLabel ? buyLabel(i) : tr("اشترِ الآن", "Buy now")}
                  </button>
                  {off && lockedNote && <p className="mt-2 text-center text-xs font-bold text-ink-soft">{lockedNote(i)}</p>}
                </>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
