"use client";
// Hand a visitor over to Pi Browser. Pi Browser is the only place Pi payments and the Pi SDK sign-in work.
// Healthy has a PiNet URL (https://<subdomain>.pinet.com) that Pi Browser opens as the app. On Android the app is
// launched with an intent URL (the same form Pi's own sign-in pages use; package "pi.browser"). This is
// reverse-engineered from Pi's public web pages, NOT a documented API, so it always has a plain-link fallback.

import { PINET_URL } from "@/config/pi";
export { PINET_URL };
const PI_BROWSER_PACKAGE = "pi.browser";

const ua = () => (typeof navigator === "undefined" ? "" : navigator.userAgent);
export const isAndroid = () => /android/i.test(ua());

/** Plain Chrome on Android (not Opera, Edge, Samsung, Firefox or a WebView). */
export const isAndroidChrome = () => isAndroid() && /Chrome\//.test(ua()) && !/OPR\/|Opera|EdgA|SamsungBrowser|UCBrowser|Firefox|FxiOS|Vivaldi|YaBrowser|DuckDuckGo|; wv\)/i.test(ua());

/** URL that opens `path` of Healthy inside Pi Browser (or offers to install it). */
export function piBrowserUrl(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const web = `${PINET_URL}${p === "/" ? "" : p}`;
  if (!isAndroid()) return web; // iOS and desktop: the PiNet page itself offers to open / install Pi Browser
  const host = PINET_URL.replace(/^https?:\/\//, "");
  const store = new URL("https://play.google.com/store/apps/details");
  store.searchParams.set("id", PI_BROWSER_PACKAGE);
  store.searchParams.set("referrer", `redirect=${encodeURIComponent(`${host}${p === "/" ? "" : p}`)}`);
  return `intent://${host}${p}#Intent;scheme=https;package=${PI_BROWSER_PACKAGE};S.browser_fallback_url=${encodeURIComponent(store.toString())};end`;
}
