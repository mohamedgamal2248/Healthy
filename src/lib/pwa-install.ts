"use client";
// Shared "install the app" state. The browser fires `beforeinstallprompt` ONCE, early in the page load,
// so it is captured here at module load and shared with every component that offers installation.
import { useEffect, useState } from "react";
import { isPiBrowser } from "./pi-client";

export type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallEvent; notify(); });
  window.addEventListener("appinstalled", () => { installed = true; deferred = null; notify(); });
}

const DISMISS_KEY = "healthy.install.dismissed";
const DISMISS_DAYS = 14;

export const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
export const isIos = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

export function dismissedRecently(): boolean {
  try { const t = Number(localStorage.getItem(DISMISS_KEY) || 0); return !!t && Date.now() - t < DISMISS_DAYS * 86400_000; } catch { return false; }
}
export function rememberDismiss() { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ } }

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  const e = deferred;
  deferred = null;
  notify();
  await e.prompt();
  const r = await e.userChoice.catch(() => ({ outcome: "dismissed" }));
  return r.outcome === "accepted" ? "accepted" : "dismissed";
}

/** Reactive view of the install state for components. */
export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return {
    canPrompt: !!deferred,
    ios: isIos(),
    standalone: installed || isStandalone(),
    inPiBrowser: isPiBrowser(),
  };
}
