"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

// Module-level stale-while-revalidate cache: tab switches show the last data instantly, then refresh quietly.
const cache = new Map<string, unknown>();
export const clearGetCache = () => cache.clear();

export function useGet<T>(path: string | null, onError?: (e: unknown) => void) {
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
      const r = await api<T>(path);
      cache.set(path, r);
      setDataState(r);
    } catch (e) {
      errRef.current?.(e);
    }
  }, [path]);

  useEffect(() => {
    setDataState(path && cache.has(path) ? (cache.get(path) as T) : null);
    reload();
  }, [path, reload]);

  return { data, setData, reload };
}
