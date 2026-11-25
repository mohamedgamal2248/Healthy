"use client";
import { useState } from "react";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { Sheet, Spinner } from "./ui";
import { PINET_URL } from "@/config/pi";
export { CARD_W, CARD_H, cardFont, fitText, startCard } from "@/lib/cards";

const enc = encodeURIComponent;

/**
 * "Share" button with a preview sheet. Native share (with the image) where the device supports it; otherwise the image is shown
 * with buttons for X, WhatsApp, download and copy. Every text carries the app's PiNet link so a friend lands in Pi Browser.
 * The card holds no health data: only what the caller draws.
 */
export function ShareCard({ label, title, filename, text, draw }: { label: string; title: string; filename: string; text: string; draw: () => HTMLCanvasElement }) {
  const { tr, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const message = `${text}\n${PINET_URL}`;
  const make = () => new Promise<Blob>((resolve, reject) => {
    try { draw().toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png"); } catch (e) { reject(e); }
  });
  const close = () => { if (preview) URL.revokeObjectURL(preview.url); setPreview(null); };
  const open = async () => {
    setBusy(true);
    try {
      const blob = await make();
      const file = new File([blob], filename, { type: "image/png" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "Healthy", text: message }); return; }
        catch (e) { if ((e as Error)?.name === "AbortError") return; }
      }
      setPreview({ url: URL.createObjectURL(blob), blob });
    } catch { toast(tr("تعذّر إنشاء الصورة.", "Could not create the image."), "err"); }
    finally { setBusy(false); }
  };
  const download = () => {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview.url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const go = (url: string) => { window.open(url, "_blank", "noopener,noreferrer"); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(message); toast(tr("تم نسخ النص والرابط", "Text and link copied"), "ok"); }
    catch { toast(tr("تعذّر النسخ.", "Could not copy."), "err"); }
  };
  return (
    <>
      <button className="btn-soft w-full" onClick={open} disabled={busy}>{busy ? <Spinner size={18} /> : <Icon name="share" size={18} />}{label}</button>
      <Sheet open={!!preview} onClose={close} title={title}>
        {preview && (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.url} alt={title} className="mx-auto max-h-[46dvh] w-auto rounded-2xl border border-line" />
            <p className="muted text-center">{tr("احفظ الصورة (اضغط مطولًا عليها أو زر التنزيل) ثم أرفقها بمنشورك. النص يحتوي رابط التطبيق.", "Save the image (press and hold it, or use Download) and attach it to your post. The text already has the app link.")}</p>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-primary" onClick={() => go(`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(PINET_URL)}`)}>{tr("انشر على X", "Post on X")}</button>
              <button className="btn-primary" onClick={() => go(`https://wa.me/?text=${enc(message)}`)}>{tr("واتساب", "WhatsApp")}</button>
              <button className="btn-soft" onClick={download}><Icon name="copy" size={18} />{tr("تنزيل الصورة", "Download image")}</button>
              <button className="btn-soft" onClick={copy}><Icon name="link" size={18} />{tr("نسخ النص والرابط", "Copy text and link")}</button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
