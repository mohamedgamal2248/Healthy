"use client";
import { useState } from "react";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { Spinner } from "./ui";
import { PINET_URL } from "@/config/pi";

/**
 * "Share" button that shares one thing: a short text and the app's PiNet link. It uses the device's own share sheet
 * when there is one, otherwise it copies the text and link. No images, no per-platform buttons, nothing is uploaded.
 */
export function ShareLink({ label, text }: { label: string; text: string }) {
  const { tr, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const share = async () => {
    setBusy(true);
    try {
      if (typeof navigator.share === "function") {
        try { await navigator.share({ title: "Healthy", text, url: PINET_URL }); return; }
        catch (e) { if ((e as Error)?.name === "AbortError") return; /* otherwise fall back to copying */ }
      }
      await navigator.clipboard.writeText(`${text} ${PINET_URL}`);
      toast(tr("تم نسخ الرابط", "Link copied"), "ok");
    } catch { toast(tr("تعذّرت المشاركة.", "Could not share."), "err"); }
    finally { setBusy(false); }
  };
  return <button className="btn-soft w-full" onClick={share} disabled={busy}>{busy ? <Spinner size={18} /> : <Icon name="share" size={18} />}{label}</button>;
}
