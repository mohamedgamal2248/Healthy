"use client";
import { useMemo } from "react";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { ShareLink } from "./ShareLink";
import { addDays } from "@/lib/dates";

export function WeeklyCard({ today, weekDays }: { today: string; weekDays: string[] }) {
  const { tr } = useApp();
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => weekDays.includes(addDays(today, i - 6))), [today, weekDays]);
  const done = days.filter(Boolean).length;
  return (
    <section className="card space-y-3">
      <h2 className="h2">{tr("أسبوعي", "My week")}</h2>
      <div className="flex items-center justify-between gap-2" aria-label={tr(`${done} من 7 أيام`, `${done} of 7 days`)}>
        {days.map((on, i) => <span key={i} className={`flex h-9 w-9 items-center justify-center rounded-full ${on ? "bg-sun-400 text-white" : "bg-brand-50 text-brand-200"}`}>{on ? <Icon name="check" size={18} /> : <span className="h-2 w-2 rounded-full bg-current" />}</span>)}
      </div>
      <p className="muted">{tr(`${done} من 7 أيام التزام هذا الأسبوع.`, `${done} of 7 days with a challenge this week.`)}</p>
      <ShareLink
        label={tr("شارك رابط التطبيق", "Share the app link")}
        text={tr(`${done} من 7 أيام التزام هذا الأسبوع مع Healthy، تطبيق صحي لبايونيرز Pi. افتحه من Pi Browser:`, `${done} of 7 days with a challenge this week on Healthy, a health app for Pi Pioneers. Open it in Pi Browser:`)}
      />
    </section>
  );
}
