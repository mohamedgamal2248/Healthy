"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { useApp } from "./AppProvider";

type Kind = "recipe" | "workout" | "challenge" | "scan" | "fridge";

const ICON: Record<Kind, string> = { recipe: "utensils", workout: "dumbbell", challenge: "flame", scan: "camera", fridge: "image" };

/** "Coach is working" loader: spinning ring with the category icon, rotating status text, and a skeleton of the result. */
export function CoachThinking({ kind = "recipe", compact }: { kind?: Kind; compact?: boolean }) {
  const { tr } = useApp();
  const lines: Record<Kind, string[]> = {
    recipe: [tr("بنختار أنسب المكونات…", "Picking the best ingredients…"), tr("بنوازن السعرات والبروتين…", "Balancing calories and protein…"), tr("بنكتب طريقة التحضير…", "Writing the steps…"), tr("لمسات أخيرة على وجبتك…", "Final touches on your meal…")],
    workout: [tr("بنحدد مستواك…", "Gauging your level…"), tr("بنرتّب التمارين وفترات الراحة…", "Ordering moves and rest…"), tr("بنضيف الإحماء والتهدئة…", "Adding warm-up and cool-down…"), tr("لمسات أخيرة على برنامجك…", "Final touches on your workout…")],
    scan: [tr("بنتعرّف على الأكل في الصورة…", "Recognising the food in your photo…"), tr("بنقدّر الحصة والمكونات…", "Estimating portion and ingredients…"), tr("بنحسب السعرات والبروتين…", "Calculating calories and protein…"), tr("بنراجع الأرقام…", "Double-checking the numbers…")],
    fridge: [tr("بنفهم المكونات اللي عندك…", "Reading what you have…"), tr("بنختار أفكار متنوعة…", "Picking varied ideas…"), tr("بنوازنها مع باقي سعراتك اليوم…", "Fitting them to your day…"), tr("لمسات أخيرة على الأفكار…", "Final touches on the ideas…")],
    challenge: [tr("بنفكّر في تحدٍّ يناسبك…", "Designing a challenge for you…"), tr("بنقسّم الأيام لخطوات صغيرة…", "Splitting it into small daily steps…"), tr("بنضيف طريقة المتابعة…", "Adding a way to track it…"), tr("لمسات أخيرة على تحدّيك…", "Final touches on your challenge…")],
  };
  const l = lines[kind];
  const [i, setI] = useState(0);
  const [fade, setFade] = useState(false);
  useEffect(() => {
    const t = setInterval(() => {
      setFade(true);
      setTimeout(() => { setI((x) => (x + 1) % l.length); setFade(false); }, 300);
    }, 2600);
    return () => clearInterval(t);
  }, [l.length]);

  return (
    <div className="flex flex-col items-center gap-4 py-4" role="status" aria-live="polite">
      <style>{`
        @keyframes cth-spin { to { transform: rotate(360deg) } }
        @keyframes cth-sk { to { background-position: -200% 0 } }
        .cth-ring { animation: cth-spin 1.3s linear infinite }
        .cth-sk { display:block; border-radius:8px; background: linear-gradient(90deg,#e8f3ee 25%,#f7fcfa 50%,#e8f3ee 75%); background-size: 200% 100%; animation: cth-sk 1.4s linear infinite }
        @media (prefers-reduced-motion: reduce) { .cth-ring,.cth-sk { animation: none } }
      `}</style>
      <div className="relative" style={{ width: compact ? 64 : 96, height: compact ? 64 : 96 }}>
        <svg className="cth-ring absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#d1fae5" strokeWidth="8" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="#10b981" strokeWidth="8" strokeLinecap="round" strokeDasharray="70 210" />
        </svg>
        <div className="absolute flex items-center justify-center rounded-full bg-brand-50 text-brand-600" style={{ inset: compact ? 9 : 14 }}>
          <Icon name={ICON[kind]} size={compact ? 22 : 34} />
        </div>
      </div>
      <p className={`min-h-6 text-center font-extrabold text-brand-800 transition-opacity duration-300 ${fade ? "opacity-0" : "opacity-100"}`}>{l[i]}</p>
      {!compact && (
        <div className="w-full max-w-sm space-y-2.5" aria-hidden="true">
          <i className="cth-sk h-[18px] w-3/5" />
          <div className="flex gap-2"><i className="cth-sk h-[22px] w-1/3 !rounded-full" /><i className="cth-sk h-[22px] w-1/3 !rounded-full" /></div>
          <i className="cth-sk h-3 w-full" />
          <i className="cth-sk h-3 w-[88%]" />
          <i className="cth-sk h-3 w-[72%]" />
        </div>
      )}
      {!compact && <p className="muted text-center">{tr("عادة من ٢٠ إلى ٦٠ ثانية. لو اتأخر أكتر من كده بيرجع الكريدت تلقائيًا.", "Usually 20 to 60 seconds. If it takes longer, your credit is refunded automatically.")}</p>}
    </div>
  );
}
