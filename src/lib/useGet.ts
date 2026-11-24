"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

// Module-level stale-while-revalidate cache: tab switches show the last data instantly, then refresh quietly.
const cache = new Map<string, unknown>();
export const clearGetCache = () => { cache.clear(); inflight.clear(); };

// One request per path at a time: a page asking for data that a prefetch is already loading simply waits for it.
const inflight = new Map<string, Promise<unknown>>();
function fetchOnce<T>(path: string, anon: boolean): Promise<T> {
  const key = `${anon ? "anon:" : ""}${path}`;
  const hit = inflight.get(key);
  if (hit) return hit as Promise<T>;
  const p = api<T>(path, { anon }).then((r) => { cache.set(path, r); return r; }).finally(() => { if (inflight.get(key) === p) inflight.delete(key); });
  inflight.set(key, p);
  return p;
}

/** The data each page needs first, keyed by route. Started at boot IN PARALLEL with sign-in (/me), so the page does not wait for it. */
const ROUTE_DATA: Record<string, { path: string; anon?: boolean }[]> = {
  "/plan": [{ path: "/plan" }],
  "/progress": [{ path: "/progress" }],
  "/community": [{ path: "/public/community", anon: true }, { path: "/community/me" }],
  "/today": [{ path: "/today" }],
  "/diary": [{ path: "/food" }],
};
export function prefetchRoute(pathname: string) {
  for (const d of ROUTE_DATA[pathname.replace(/\/$/, "")] ?? []) fetchOnce(d.path, !!d.anon).catch(() => {});
}

export function useGet<T>(path: string | null, onError?: (e: unknown) => void, opts: { anon?: boolean } = {}) {
  const anon = !!opts.anon;
  const [data, setDataState] = useState<T | null>(path && cache.has(path) ? (cache.get(path) as T) : null);
  const errRef = useRef(onError);
  errRef.current = onError;

  const setData = useCallback((v: T | null) => {
    setDataState(v);
    if (path && v !== null) cache.set(path, v);
  }, [path]);

  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const r = await fetchOnce<T>(path, anon);
      setDataState(r);
    } catch (e) {
      errRef.current?.(e);
    }
  }, [path, anon]);

  useEffect(() => {
    setDataState(path && cache.has(path) ? (cache.get(path) as T) : null);
    reload();
  }, [path, reload]);

  // Quick actions (e.g. "+1 water" from the floating button) ask open pages to refetch.
  useEffect(() => {
    const on = () => { reload(); };
    window.addEventListener("healthy:refresh", on);
    return () => window.removeEventListener("healthy:refresh", on);
  }, [reload]);

  return { data, setData, reload };
}
