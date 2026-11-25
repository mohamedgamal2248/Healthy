"use client";
import { useApp } from "./AppProvider";
import { ShareCard } from "./ShareCard";
import { drawPlanCard } from "@/lib/cards";
import type { PlanDay } from "@/lib/planner";

export function PlanCard({ days }: { days: PlanDay[] }) {
  const { tr, lang } = useApp();
  const now = new Date();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const day = days.find((d) => d.date === iso) ?? days[0];
  return (
    <ShareCard
      label={tr("شارك خطتي", "Share my plan")}
      title={tr("بطاقة خطتي", "My plan card")}
      filename="healthy-plan.png"
      text={tr("خطتي الأسبوعية على Healthy: أكل مصري اقتصادي وذكاء اصطناعي، لبايونيرز Pi. افتحه من Pi Browser:", "My weekly plan on Healthy: affordable Egyptian meals and AI, for Pi Pioneers. Open it in Pi Browser:")}
      draw={() => drawPlanCard(day, lang === "ar")}
    />
  );
}
