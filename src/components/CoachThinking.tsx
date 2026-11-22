"use client";
import { useEffect, useState } from "react";
import { useApp } from "./AppProvider";

type Kind = "recipe" | "workout" | "challenge";

// "Coach thinking" animation: a glowing AI core with orbiting meal / workout / habit icons (inline SVG + CSS).
export function CoachThinking({ kind = "recipe", compact }: { kind?: Kind; compact?: boolean }) {
  const { tr } = useApp();
  const lines: Record<Kind, string[]> = {
    recipe: [tr("بنختار أنسب المكونات…", "Picking the best ingredients…"), tr("بنوازن السعرات والبروتين…", "Balancing calories and protein…"), tr("بنكتب الخطوات بالتفصيل…", "Writing the steps…"), tr("لمسات أخيرة…", "Final touches…")],
    workout: [tr("بنحدد مستواك…", "Gauging your level…"), tr("بنرتّب التمارين والراحة…", "Ordering moves and rest…"), tr("بنظبط الإحماء والتهدئة…", "Adding warm-up and cool-down…"), tr("لمسات أخيرة…", "Final touches…")],
    challenge: [tr("بنفكر في تحدٍّ يناسبك…", "Designing a challenge for you…"), tr("بنقسّم الأيام لخطوات صغيرة…", "Splitting it into small daily steps…"), tr("بنضيف طريقة المتابعة…", "Adding a way to track it…"), tr("لمسات أخيرة…", "Final touches…")],
  };
  const l = lines[kind];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % l.length), 3200);
    return () => clearInterval(t);
  }, [l.length]);
  const size = compact ? 104 : 220;
  return (
    <div className="flex flex-col items-center gap-3 py-4" role="status" aria-live="polite">
      <style>{`
        @keyframes ct-spin { to { transform: rotate(360deg) } }
        @keyframes ct-spin-rev { to { transform: rotate(-360deg) } }
        @keyframes ct-pulse { 0%,100% { transform: scale(1); opacity: .95 } 50% { transform: scale(1.09); opacity: 1 } }
        @keyframes ct-glow { 0%,100% { opacity: .25; transform: scale(1) } 50% { opacity: .6; transform: scale(1.18) } }
        @keyframes ct-twinkle { 0%,100% { opacity: .2; transform: scale(.6) } 50% { opacity: 1; transform: scale(1) } }
        @keyframes ct-dash { to { stroke-dashoffset: -60 } }
        .ct-orbit { animation: ct-spin 9s linear infinite; transform-origin: 100px 100px }
        .ct-orbit2 { animation: ct-spin-rev 14s linear infinite; transform-origin: 100px 100px }
        .ct-counter { animation: ct-spin-rev 9s linear infinite; transform-box: fill-box; transform-origin: center }
        .ct-counter2 { animation: ct-spin 14s linear infinite; transform-box: fill-box; transform-origin: center }
        .ct-core { animation: ct-pulse 1.8s ease-in-out infinite; transform-origin: 100px 100px }
        .ct-glow { animation: ct-glow 2.4s ease-in-out infinite; transform-origin: 100px 100px }
        .ct-star { animation: ct-twinkle 1.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center }
        .ct-dash { animation: ct-dash 2s linear infinite }
        @media (prefers-reduced-motion: reduce) { .ct-orbit,.ct-orbit2,.ct-counter,.ct-counter2,.ct-core,.ct-glow,.ct-star,.ct-dash { animation: none } }
      `}</style>
      <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <radialGradient id="ct-g" cx="50%" cy="40%" r="65%"><stop offset="0" stopColor="#6ee7b7" /><stop offset="1" stopColor="#047857" /></radialGradient>
        </defs>
        {/* soft glow + rings */}
        <circle className="ct-glow" cx="100" cy="100" r="46" fill="#34d399" />
        <circle cx="100" cy="100" r="62" fill="none" stroke="#a7f3d0" strokeWidth="2" strokeDasharray="4 8" className="ct-dash" />
        <circle cx="100" cy="100" r="86" fill="none" stroke="#d1fae5" strokeWidth="2" />
        {/* twinkles */}
        {[[34, 46, 0], [168, 58, 0.5], [40, 154, 1], [160, 150, 1.4], [100, 14, 0.8]].map(([x, y, d]) => (
          <path key={`${x}${y}`} className="ct-star" d={`M${x} ${Number(y) - 6} l1.6 4.4 4.4 1.6 -4.4 1.6 -1.6 4.4 -1.6 -4.4 -4.4 -1.6 4.4 -1.6z`} fill="#f59e0b" style={{ animationDelay: `${d}s` }} />
        ))}
        {/* outer orbit: dumbbell, apple, drop */}
        <g className="ct-orbit">
          <g className="ct-counter" transform="translate(100 14)">
            <rect x="-9" y="-3" width="18" height="6" rx="3" fill="#475569" />
            <rect x="-13" y="-8" width="5" height="16" rx="2" fill="#0f172a" /><rect x="8" y="-8" width="5" height="16" rx="2" fill="#0f172a" />
          </g>
          <g className="ct-counter" transform="translate(186 100)">
            <path d="M0 -6 c-8 -6 -14 4 -9 12 c3 5 7 4 9 3 c2 1 6 2 9 -3 c5 -8 -1 -18 -9 -12z" fill="#ef4444" />
            <path d="M0 -6 c0 -5 3 -8 6 -9" stroke="#15803d" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </g>
          <g className="ct-counter" transform="translate(100 186)">
            <path d="M0 -11 c6 8 9 12 9 17 a9 9 0 0 1 -18 0 c0 -5 3 -9 9 -17z" fill="#0ea5e9" />
          </g>
        </g>
        {/* inner orbit: flame, leaf, moon */}
        <g className="ct-orbit2">
          <g className="ct-counter2" transform="translate(100 38)">
            <path d="M0 -11 c4 5 8 8 8 13 a8 8 0 0 1 -16 0 c0 -3 2 -5 3 -7 c1 2 2 3 4 3 c0 -4 -1 -6 1 -9z" fill="#f59e0b" />
          </g>
          <g className="ct-counter2" transform="translate(162 100)">
            <path d="M-9 8 c-1 -12 6 -18 17 -18 c1 12 -5 19 -17 18z" fill="#22c55e" /><path d="M-8 8 l10 -10" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          </g>
          <g className="ct-counter2" transform="translate(38 100)">
            <path d="M6 -9 a10 10 0 1 0 5 15 a8 8 0 0 1 -5 -15z" fill="#8b5cf6" />
          </g>
        </g>
        {/* core */}
        <g className="ct-core">
          <circle cx="100" cy="100" r="30" fill="url(#ct-g)" />
          <path d="M100 82 l4.6 12.4 12.4 4.6 -12.4 4.6 -4.6 12.4 -4.6 -12.4 -12.4 -4.6 12.4 -4.6z" fill="#fff" />
          <path d="M120 80 l1.8 4.6 4.6 1.8 -4.6 1.8 -1.8 4.6 -1.8 -4.6 -4.6 -1.8 4.6 -1.8z" fill="#fff" opacity=".85" />
        </g>
      </svg>
      <p className="text-center font-extrabold text-brand-800">{l[i]}</p>
      {!compact && <p className="muted text-center">{tr("قد يستغرق الأمر حتى دقيقة", "This can take up to a minute")}</p>}
    </div>
  );
}
