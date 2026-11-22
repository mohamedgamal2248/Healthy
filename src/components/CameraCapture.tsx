"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { useApp } from "./AppProvider";
import { toCompressedDataUrl } from "@/lib/image";

/** Full-screen in-app camera (getUserMedia). If the browser blocks it, onUnavailable lets the caller fall back to the native picker. */
export function CameraCapture({ onCapture, onClose, onUnavailable }: { onCapture: (dataUrl: string) => void; onClose: () => void; onUnavailable: () => void }) {
  const { tr } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const stop = useCallback(() => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) { v.srcObject = stream; await v.play().catch(() => {}); setReady(true); }
      } catch {
        if (!cancelled) onUnavailable();
      }
    })();
    return () => { cancelled = true; stop(); };
  }, [onUnavailable, stop]);

  const snap = async () => {
    const v = videoRef.current;
    if (!v || !ready || busy) return;
    setBusy(true);
    try { onCapture(await toCompressedDataUrl(v)); stop(); } catch { onUnavailable(); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={tr("الكاميرا", "Camera")}>
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {/* framing guide */}
        <div className="pointer-events-none absolute inset-6 rounded-3xl border-2 border-white/60" />
        <p className="pointer-events-none absolute inset-x-0 top-8 text-center text-sm font-extrabold text-white drop-shadow">{tr("صوّر الطبق من فوق وبإضاءة كويسة", "Shoot the plate from above in good light")}</p>
        {!ready && <p className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white/80">{tr("جاري فتح الكاميرا…", "Opening the camera…")}</p>}
      </div>
      <div className="flex items-center justify-between gap-4 bg-black px-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        <button onClick={() => { stop(); onClose(); }} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white" aria-label={tr("إغلاق", "Close")}><Icon name="x" size={22} /></button>
        <button onClick={snap} disabled={!ready || busy} aria-label={tr("التقاط", "Capture")} className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20 transition active:scale-90 disabled:opacity-40"><span className="h-14 w-14 rounded-full bg-white" /></button>
        <span className="h-12 w-12" />
      </div>
    </div>
  );
}
