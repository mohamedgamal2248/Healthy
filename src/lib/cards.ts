import { PINET_URL } from "@/config/pi";
import type { PlanDay } from "./planner";

/** Shared drawing helpers for the share cards (drawn on the device; nothing is uploaded). */
export const CARD_W = 1080;
export const CARD_H = 1350;
export const cardFont = (px: number, w = 800) => `${w} ${px}px Cairo, Inter, system-ui, sans-serif`;

/** Green gradient background, soft circle, brand ring + spark and the "Healthy" wordmark. Returns the canvas context. */
export function startCard(ar: boolean): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement("canvas");
  c.width = CARD_W; c.height = CARD_H;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, CARD_W, CARD_H);
  bg.addColorStop(0, "#34d399"); bg.addColorStop(1, "#065f46");
  g.fillStyle = bg; g.fillRect(0, 0, CARD_W, CARD_H);
  g.fillStyle = "rgba(255,255,255,.08)"; g.beginPath(); g.arc(CARD_W - 120, 160, 360, 0, Math.PI * 2); g.fill();
  g.direction = ar ? "rtl" : "ltr";
  g.textAlign = "center";
  const cx = CARD_W / 2;
  g.lineWidth = 26; g.lineCap = "round"; g.strokeStyle = "rgba(255,255,255,.25)"; g.beginPath(); g.arc(cx, 190, 80, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = "#fff"; g.beginPath(); g.arc(cx, 190, 80, -Math.PI / 2, Math.PI * 1.0); g.stroke();
  g.fillStyle = "#fbbf24"; g.beginPath(); g.moveTo(cx, 150); g.quadraticCurveTo(cx + 4, 186, cx + 40, 190); g.quadraticCurveTo(cx + 4, 194, cx, 230); g.quadraticCurveTo(cx - 4, 194, cx - 40, 190); g.quadraticCurveTo(cx - 4, 186, cx, 150); g.fill();
  g.fillStyle = "#fff"; g.font = cardFont(54); g.fillText("Healthy", cx, 340);
  return { c, g };
}

/** Fits one line of text into `max` px by shrinking the font a little, then trimming with an ellipsis. */
export function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, px: number, w = 700) {
  let size = px;
  g.font = cardFont(size, w);
  while (g.measureText(text).width > max && size > px * 0.7) { size -= 2; g.font = cardFont(size, w); }
  let t = text;
  while (g.measureText(t).width > max && t.length > 3) t = t.slice(0, -2);
  g.fillText(t === text ? t : `${t.trimEnd()}…`, x, y);
}

/** Draws the weekly share card on a canvas, on the device: nothing is uploaded and it carries no health information. */
export function drawWeekCard(opts: { days: boolean[]; done: number; streak: number; total: number; ar: boolean; user: string }): HTMLCanvasElement {
  const { c, g } = startCard(opts.ar);
  const cx = CARD_W / 2;
  g.fillStyle = "#fff";
  g.font = cardFont(60, 700); g.fillText(opts.ar ? "أسبوعي على Healthy" : "My week on Healthy", cx, 470);
  g.font = cardFont(300, 900); g.fillText(`${opts.done}/7`, cx, 760);
  g.font = cardFont(56, 700); g.fillText(opts.ar ? "أيام التزام" : "days of challenges", cx, 850);
  // seven day dots
  const r = 52, gap = 40, startX = cx - (7 * 2 * r + 6 * gap) / 2 + r;
  opts.days.forEach((on, i) => {
    const x = startX + i * (2 * r + gap);
    g.beginPath(); g.arc(x, 990, r, 0, Math.PI * 2);
    g.fillStyle = on ? "#fbbf24" : "rgba(255,255,255,.2)"; g.fill();
    if (on) { g.strokeStyle = "#065f46"; g.lineWidth = 12; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(x - 20, 992); g.lineTo(x - 5, 1007); g.lineTo(x + 22, 975); g.stroke(); }
  });
  g.fillStyle = "#fff"; g.font = cardFont(56, 800);
  g.fillText(opts.ar ? `سلسلة ${opts.streak} يوم · ${opts.total} تحدي` : `${opts.streak}-day streak · ${opts.total} challenges`, cx, 1160);
  g.font = cardFont(38, 600); g.fillStyle = "rgba(255,255,255,.85)"; g.fillText(`@${opts.user}`, cx, 1260);
  return c;
}

const LABEL = { breakfast: ["فطار", "Breakfast"], lunch: ["غدا", "Lunch"], dinner: ["عشا", "Dinner"] } as const;

/**
 * Share card for the weekly plan: today's three meals by name. Names only, so nothing about the
 * person's health is on the image; they can still see their numbers in the app.
 */
export function drawPlanCard(day: PlanDay | undefined, ar: boolean): HTMLCanvasElement {
  const { c, g } = startCard(ar);
  const cx = CARD_W / 2;
  g.fillStyle = "#fff";
  g.font = cardFont(60, 700); g.fillText(ar ? "خطتي على Healthy" : "My plan on Healthy", cx, 470);
  g.font = cardFont(40, 600); g.fillStyle = "rgba(255,255,255,.85)";
  g.fillText(ar ? "٧ أيام من الأكل المصري الاقتصادي" : "7 days of affordable Egyptian meals", cx, 545);
  g.fillStyle = "#fbbf24"; g.font = cardFont(44, 800); g.fillText(ar ? "وجبات اليوم" : "Today's meals", cx, 700);
  const slots = (["breakfast", "lunch", "dinner"] as const).map((t) => day?.slots.find((s) => s.type === t));
  slots.forEach((s, i) => {
    const y = 800 + i * 150;
    g.fillStyle = "rgba(255,255,255,.14)";
    g.beginPath(); if (g.roundRect) g.roundRect(90, y - 66, CARD_W - 180, 116, 28); else g.rect(90, y - 66, CARD_W - 180, 116); g.fill();
    g.fillStyle = "rgba(255,255,255,.8)"; g.font = cardFont(32, 700);
    g.fillText(LABEL[(["breakfast", "lunch", "dinner"] as const)[i]][ar ? 0 : 1], cx, y - 18);
    g.fillStyle = "#fff";
    if (s) fitText(g, ar ? s.name_ar : s.name_en, cx, y + 28, CARD_W - 260, 42, 800);
  });
  g.font = cardFont(38, 600); g.fillStyle = "rgba(255,255,255,.85)";
  g.fillText(PINET_URL.replace(/^https?:\/\//, ""), cx, 1260);
  return c;
}

