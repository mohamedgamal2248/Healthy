"use client";
import { useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { Sheet, Spinner } from "./ui";
import { addDays } from "@/lib/dates";

/** Draws the weekly share card on a canvas, on the device: nothing is uploaded and it carries no health information. */
function draw(opts: { days: boolean[]; done: number; streak: number; total: number; ar: boolean; user: string }): HTMLCanvasElement {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#34d399"); bg.addColorStop(1, "#065f46");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,.08)"; g.beginPath(); g.arc(W - 120, 160, 360, 0, Math.PI * 2); g.fill();
  const font = (px: number, w = 800) => `${w} ${px}px Cairo, Inter, system-ui, sans-serif`;
  g.direction = opts.ar ? "rtl" : "ltr";
  g.textAlign = "center";
  // brand mark (ring + spark)
  const cx = W / 2;
  g.lineWidth = 26; g.lineCap = "round"; g.strokeStyle = "rgba(255,255,255,.25)"; g.beginPath(); g.arc(cx, 190, 80, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = "#fff"; g.beginPath(); g.arc(cx, 190, 80, -Math.PI / 2, Math.PI * 1.0); g.stroke();
  g.fillStyle = "#fbbf24"; g.beginPath(); g.moveTo(cx, 150); g.quadraticCurveTo(cx + 4, 186, cx + 40, 190); g.quadraticCurveTo(cx + 4, 194, cx, 230); g.quadraticCurveTo(cx - 4, 194, cx - 40, 190); g.quadraticCurveTo(cx - 4, 186, cx, 150); g.fill();
  g.fillStyle = "#fff"; g.font = font(54); g.fillText("Healthy", cx, 340);
  g.font = font(60, 700); g.fillText(opts.ar ? "أسبوعي على Healthy" : "My week on Healthy", cx, 470);
  g.font = font(300, 900); g.fillText(`${opts.done}/7`, cx, 760);
  g.font = font(56, 700); g.fillText(opts.ar ? "أيام التزام" : "days of challenges", cx, 850);
  // seven day dots
  const r = 52, gap = 40, startX = cx - (7 * 2 * r + 6 * gap) / 2 + r;
  opts.days.forEach((on, i) => {
    const x = startX + i * (2 * r + gap);
    g.beginPath(); g.arc(x, 990, r, 0, Math.PI * 2);
    g.fillStyle = on ? "#fbbf24" : "rgba(255,255,255,.2)"; g.fill();
    if (on) { g.strokeStyle = "#065f46"; g.lineWidth = 12; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(x - 20, 992); g.lineTo(x - 5, 1007); g.lineTo(x + 22, 975); g.stroke(); }
  });
  g.fillStyle = "#fff"; g.font = font(56, 800);
  g.fillText(opts.ar ? `سلسلة ${opts.streak} يوم · ${opts.total} تحدي` : `${opts.streak}-day streak · ${opts.total} challenges`, cx, 1160);
  g.font = font(38, 600); g.fillStyle = "rgba(255,255,255,.85)"; g.fillText(`@${opts.user}`, cx, 1260);
  return c;
}

export function WeeklyCard({ today, weekDays, streak, total, username }: { today: string; weekDays: string[]; streak: number; total: number; username: string }) {
  const { tr, lang, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => weekDays.includes(addDays(today, i - 6))), [today, weekDays]);
  const done = days.filter(Boolean).length;
  const make = () => new Promise<Blob>((resolve, reject) => {
    try { draw({ days, done, streak, total, ar: lang === "ar", user: username }).toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png"); } catch (e) { reject(e); }
  });
  const closePreview = () => { if (preview) URL.revokeObjectURL(preview.url); setPreview(null); };
  const share = async () => {
    setBusy(true);
    try {
      const blob = await make();
      const file = new File([blob], "healthy-week.png", { type: "image/png" });
      // 1) Native share sheet with the image (Chrome/Opera/Safari on phones).
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "Healthy", text: tr("أسبوعي على Healthy", "My week on Healthy") }); return; }
        catch (e) { if ((e as Error)?.name === "AbortError") return; /* otherwise fall through to the preview */ }
      }
      // 2) Webviews (for example Pi Browser) often can't share files or start downloads: show the image so it can be
      //    saved with a long-press, plus a download button for desktop browsers.
      setPreview({ url: URL.createObjectURL(blob), blob });
    } catch {
      toast(tr("تعذّر إنشاء الصورة.", "Could not create the image."), "err");
    } finally { setBusy(false); }
  };
  const download = () => {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview.url; a.download = "healthy-week.png";
    document.body.appendChild(a); a.click(); a.remove();
  };
  return (
    <section className="card space-y-3">
      <h2 className="h2">{tr("أسبوعي", "My week")}</h2>
      <div className="flex items-center justify-between gap-2" aria-label={tr(`${done} من 7 أيام`, `${done} of 7 days`)}>
        {days.map((on, i) => <span key={i} className={`flex h-9 w-9 items-center justify-center rounded-full ${on ? "bg-sun-400 text-white" : "bg-brand-50 text-brand-200"}`}>{on ? <Icon name="check" size={18} /> : <span className="h-2 w-2 rounded-full bg-current" />}</span>)}
      </div>
      <p className="muted">{tr(`${done} من 7 أيام التزام هذا الأسبوع.`, `${done} of 7 days with a challenge this week.`)}</p>
      <button className="btn-soft w-full" onClick={share} disabled={busy}>{busy ? <Spinner size={18} /> : <Icon name="share" size={18} />}{tr("شارك بطاقة أسبوعي", "Share my week card")}</button>
      <Sheet open={!!preview} onClose={closePreview} title={tr("بطاقة أسبوعي", "My week card")}>
        {preview && (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.url} alt={tr("بطاقة أسبوعي", "My week card")} className="mx-auto max-h-[60dvh] w-auto rounded-2xl border border-line" />
            <p className="muted text-center">{tr("اضغط مطولًا على الصورة لحفظها أو مشاركتها.", "Press and hold the image to save or share it.")}</p>
            <button className="btn-primary w-full" onClick={download}><Icon name="copy" size={18} />{tr("تنزيل الصورة", "Download image")}</button>
          </div>
        )}
      </Sheet>
    </section>
  );
}
