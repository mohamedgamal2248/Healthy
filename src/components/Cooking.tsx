"use client";
import { useEffect, useState } from "react";
import { useApp } from "./AppProvider";

// Animated cooking pot (inline SVG + CSS keyframes) shown while the AI Coach is working.
export function CookingAnimation({ compact }: { compact?: boolean }) {
  const { tr } = useApp();
  const lines = [
    tr("الكوتش بيجمّع المعلومات…", "The coach is gathering what it needs…"),
    tr("بنقلّب الطلب على نار هادية…", "Stirring it on a low flame…"),
    tr("بنظبط التفاصيل والكميات…", "Balancing the details…"),
    tr("لمسات أخيرة وجاهز…", "Final touches, almost ready…"),
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % lines.length), 3500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const size = compact ? 96 : 200;
  return (
    <div className="flex flex-col items-center gap-3 py-4" role="status" aria-live="polite">
      <style>{`
        @keyframes cook-steam { 0% { transform: translateY(8px) scaleX(.8); opacity: 0 } 30% { opacity: .9 } 100% { transform: translateY(-26px) scaleX(1.25); opacity: 0 } }
        @keyframes cook-stir { 0%,100% { transform: rotate(-16deg) } 50% { transform: rotate(16deg) } }
        @keyframes cook-bubble { 0% { transform: translateY(0) scale(.5); opacity: 0 } 30% { opacity: 1 } 100% { transform: translateY(-22px) scale(1); opacity: 0 } }
        @keyframes cook-flame { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(1.25) } }
        @keyframes cook-hop { 0%,100% { transform: translateY(0) rotate(0) } 50% { transform: translateY(-14px) rotate(25deg) } }
        @keyframes cook-lid { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
        .cook-steam { animation: cook-steam 2.4s ease-out infinite; transform-box: fill-box; transform-origin: center bottom }
        .cook-spoon { animation: cook-stir 1.6s ease-in-out infinite; transform-origin: 100px 78px }
        .cook-bubble { animation: cook-bubble 1.8s ease-in infinite; transform-box: fill-box; transform-origin: center }
        .cook-flame { animation: cook-flame .6s ease-in-out infinite; transform-box: fill-box; transform-origin: center bottom }
        .cook-hop { animation: cook-hop 2.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center }
        @media (prefers-reduced-motion: reduce) { .cook-steam,.cook-spoon,.cook-bubble,.cook-flame,.cook-hop { animation: none } }
      `}</style>
      <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
        {/* floating ingredients */}
        <circle className="cook-hop" cx="44" cy="70" r="9" fill="#f59e0b" style={{ animationDelay: "0s" }} />
        <ellipse className="cook-hop" cx="160" cy="62" rx="11" ry="7" fill="#34d399" style={{ animationDelay: ".7s" }} />
        <circle className="cook-hop" cx="150" cy="104" r="7" fill="#fb7185" style={{ animationDelay: "1.3s" }} />
        <ellipse className="cook-hop" cx="52" cy="108" rx="8" ry="11" fill="#6ee7b7" style={{ animationDelay: "1.8s" }} />
        {/* steam */}
        {[78, 100, 122].map((x, k) => (
          <path key={x} className="cook-steam" d={`M${x} 70 c-6 -8 6 -12 0 -20`} fill="none" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" style={{ animationDelay: `${k * 0.7}s` }} />
        ))}
        {/* flame */}
        <g>
          {[78, 100, 122].map((x, k) => (
            <path key={x} className="cook-flame" d={`M${x} 176 c-9 -8 -7 -18 0 -26 c2 6 10 10 8 20 c-1 4 -4 6 -8 6z`} fill={k === 1 ? "#f59e0b" : "#fbbf24"} style={{ animationDelay: `${k * 0.15}s` }} />
          ))}
        </g>
        <rect x="56" y="170" width="88" height="6" rx="3" fill="#475569" />
        {/* pot */}
        <path d="M52 92 h96 v38 a30 30 0 0 1 -30 30 h-36 a30 30 0 0 1 -30 -30z" fill="#059669" />
        <path d="M52 92 h96 v12 h-96z" fill="#047857" />
        <rect x="46" y="86" width="108" height="10" rx="5" fill="#10b981" />
        <path d="M40 104 h12 M148 104 h12" stroke="#047857" strokeWidth="7" strokeLinecap="round" />
        <path d="M66 112 v22" stroke="#6ee7b7" strokeWidth="5" strokeLinecap="round" opacity=".6" />
        {/* bubbles */}
        {[84, 100, 116].map((x, k) => (
          <circle key={x} className="cook-bubble" cx={x} cy="90" r="4" fill="#d1fae5" style={{ animationDelay: `${k * 0.55}s` }} />
        ))}
        {/* spoon */}
        <g className="cook-spoon">
          <rect x="97" y="30" width="6" height="58" rx="3" fill="#d6a15a" />
          <ellipse cx="100" cy="28" rx="9" ry="12" fill="#b9823f" />
        </g>
      </svg>
      <p className="text-center font-extrabold text-brand-800">{lines[i]}</p>
      {!compact && <p className="muted text-center">{tr("قد يستغرق الأمر حتى دقيقة", "This can take up to a minute")}</p>}
    </div>
  );
}
