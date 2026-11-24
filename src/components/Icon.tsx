import { useId, type SVGProps } from "react";

// Inline SVG icon set (stroke icons on a 24x24 grid). No emoji anywhere in the UI.
const P: Record<string, string> = {
  leaf: "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12",
  home: "M3 11.5 12 4l9 7.5 M5 10v10h5v-6h4v6h5V10",
  dumbbell: "M6.5 6.5v11 M17.5 6.5v11 M3 9v6 M21 9v6 M6.5 12h11",
  camera: "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  image: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z M9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M21 15l-5-5L5 21",
  utensils: "M7 2v20 M3.5 2v5.5a3.5 3.5 0 0 0 7 0V2 M18 22V2c-2.8 1.6-4.5 4.8-4.5 8.5V14H18",
  chef: "M6 14a4 4 0 0 1-1.5-7.7A5 5 0 0 1 12 3a5 5 0 0 1 7.5 3.3A4 4 0 0 1 18 14 M6 14h12v6a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-6Z M6 17.5h12",
  plan: "M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2 M9 2h6v4H9z M9 12h6 M9 16h4",
  chart: "M3 3v18h18 M7 15l4-4 3 3 5-6",
  users: "M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M22 20v-1a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  book: "M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2 M4 19.5A2 2 0 0 0 6 21h13",
  wallet: "M20 7H5a2 2 0 0 1 0-4h13v4 M3 5v14a2 2 0 0 0 2 2h15V7 M16 14h2",
  user: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
  flame: "M12 22c4 0 7-2.7 7-7 0-3-1.5-5-3-7-.5 2-1.5 3-3 3 0-4-1-7-4-9 0 4-4 6-4 12 0 4.3 3 8 7 8Z",
  check: "M5 13l4 4L19 7",
  checkCircle: "M22 11.1V12a10 10 0 1 1-5.9-9.1 M22 4 12 14l-3-3",
  circle: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z",
  drop: "M12 22a7 7 0 0 0 7-7c0-4-4-7.5-7-13-3 5.5-7 9-7 13a7 7 0 0 0 7 7Z",
  steps: "M4 16v-2.4C4 11.5 5 10 6.5 10S9 11.5 9 13.6V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z M15 11V8.6C15 6.5 16 5 17.5 5S20 6.5 20 8.6V11a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2Z M5.5 21h2 M16.5 18h2",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z M12 1v2 M12 21v2 M4.2 4.2l1.4 1.4 M18.4 18.4l1.4 1.4 M1 12h2 M21 12h2 M4.2 19.8l1.4-1.4 M18.4 5.6l1.4-1.4",
  heart: "M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z",
  plus: "M12 5v14 M5 12h14",
  minus: "M5 12h14",
  swap: "M16 3l4 4-4 4 M20 7H4 M8 21l-4-4 4-4 M4 17h16",
  bolt: "M13 2 3 14h9l-1 8 10-12h-9l1-8Z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
  shieldCheck: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z M9 12l2 2 4-4",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 6v6l4 2",
  star: "M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z",
  trophy: "M6 9H4.5a2.5 2.5 0 0 1 0-5H6 M18 9h1.5a2.5 2.5 0 0 0 0-5H18 M4 22h16 M10 14.7V17c0 .6-.5 1-1.1 1.2C7.8 18.7 7 20.2 7 22 M14 14.7V17c0 .6.5 1 1.1 1.2 1.1.5 1.9 2 1.9 3.8 M18 2H6v7a6 6 0 0 0 12 0V2Z",
  medal: "M7.2 2h9.6l2.2 6H5L7.2 2Z M12 22a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z M12 14v4 M10.5 15.5 12 14l1.5 1.5",
  lock: "M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M2 12h20 M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10A15 15 0 0 1 12 2Z",
  share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7 M16 6l-4-4-4 4 M12 2v14",
  send: "M22 2 11 13 M22 2l-7 20-4-9-9-4 20-7Z",
  alert: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z M12 9v4 M12 17h.01",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 16v-4 M12 8h.01",
  x: "M18 6 6 18 M6 6l12 12",
  chevronL: "M15 18l-6-6 6-6",
  chevronR: "M9 18l6-6-6-6",
  chevronD: "M6 9l6 6 6-6",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z M21 21l-4.3-4.3",
  trash: "M3 6h18 M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
  edit: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
  arrowR: "M5 12h14 M13 6l6 6-6 6",
  arrowL: "M19 12H5 M11 6l-6 6 6 6",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  sparkles: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z",
  scale: "M12 3v18 M5 21h14 M3 7h18 M6 7l-3 8a3 3 0 0 0 6 0L6 7Z M18 7l-3 8a3 3 0 0 0 6 0l-3-8Z",
  receipt: "M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3Z M9 8h6 M9 12h6",
  copy: "M9 9h11v11H9z M5 15H4V4h11v1",
  link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7 M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  filter: "M3 5h18l-7 8v6l-4 2v-8L3 5Z",
  carrot: "M2.3 21.7c1-3.5 2.5-9.5 8-14l6 6c-4.5 5.5-10.5 7-14 8Z M16 8l3-5 M14 6l5-3 M18 10l5-2",
  refresh: "M21 12a9 9 0 0 1-15.5 6.3L3 16 M3 12a9 9 0 0 1 15.5-6.3L21 8 M21 3v5h-5 M3 21v-5h5",
  pi: "M5 7h14 M9 7v11 M15 7v9a2 2 0 0 0 2 2",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  eyeOff: "M10.7 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-2.2 3 M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a10 10 0 0 0 5.4-1.6 M9.9 9.9a3 3 0 0 0 4.2 4.2 M2 2l20 20",
  calendar: "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z M16 2v4 M8 2v4 M3 10h18",
  coin: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 6v12 M9 9.5c0-1 1.3-1.8 3-1.8s3 .8 3 1.8-1.3 1.6-3 2.3-3 1.2-3 2.2 1.3 1.8 3 1.8 3-.8 3-1.8",
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 20, className, filled, ...rest }: { name: IconName | string; size?: number; filled?: boolean } & SVGProps<SVGSVGElement>) {
  const d = P[name] ?? P.circle;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {d.split(" M").map((seg, i) => (
        <path key={i} d={i === 0 ? seg : `M${seg}`} />
      ))}
    </svg>
  );
}

/** Brand mark: progress ring (daily habit) with a gold AI spark. Inline SVG so it scales crisply at any size. */
export function Logo({ size = 36 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="Healthy" className="shrink-0">
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#34d399" /><stop offset="1" stopColor="#065f46" /></linearGradient>
        <linearGradient id={`${id}gold`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fde68a" /><stop offset="1" stopColor="#f59e0b" /></linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${id}bg)`} />
      <g transform="rotate(-90 256 256)" fill="none" strokeWidth="40" strokeLinecap="round">
        <circle cx="256" cy="256" r="150" stroke="#fff" strokeOpacity=".2" />
        <circle cx="256" cy="256" r="150" stroke="#fff" strokeDasharray="290 943" />
        <circle cx="256" cy="256" r="150" stroke={`url(#${id}gold)`} strokeDasharray="200 943" strokeDashoffset="-380" />
        <circle cx="256" cy="256" r="150" stroke="#7dd3fc" strokeDasharray="180 943" strokeDashoffset="-670" />
      </g>
      <path d="M256 178c7 48 30 72 78 78-48 6-71 30-78 78-7-48-30-72-78-78 48-6 71-30 78-78z" fill="#fff" />
    </svg>
  );
}
