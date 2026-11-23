"use client";
import { useEffect } from "react";

/** Registers the service worker (installable app + push). Production only, so dev hot reload is never affected. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
