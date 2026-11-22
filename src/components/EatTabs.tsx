"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./AppProvider";

/** Meals catalogue and the personal diet plan live under one "Eat" section. */
export function EatTabs() {
  const { tr } = useApp();
  const path = usePathname();
  const tabs = [{ href: "/meals", ar: "كتالوج الوجبات", en: "Meal catalogue" }, { href: "/plan", ar: "نظامي الغذائي", en: "My diet plan" }];
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-brand-50 p-1.5" role="tablist">
      {tabs.map((t) => {
        const on = path.startsWith(t.href);
        return <Link key={t.href} href={t.href} role="tab" aria-selected={on} className={`flex min-h-11 items-center justify-center rounded-xl text-sm font-extrabold transition ${on ? "bg-white text-brand-800 shadow-sm" : "text-ink-soft"}`}>{tr(t.ar, t.en)}</Link>;
      })}
    </div>
  );
}
