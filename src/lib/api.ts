"use client";
import { DEFAULT_TZ } from "./dates";

export class ApiError extends Error {
  constructor(public status: number, public code: string, public ar: string, public en: string, public extra?: Record<string, unknown>) {
    super(en);
  }
}

const TOKEN_KEY = "healthy.token";
export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage can be blocked: session lives only in memory then */
  }
};

let memoryToken: string | null = null;
export const rememberToken = (t: string | null) => {
  memoryToken = t;
  setToken(t);
};

export function deviceTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = memoryToken ?? getToken();
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", "x-tz": deviceTz(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiError(res.status, e.code ?? "error", e.ar ?? "حدث خطأ. حاول مرة أخرى.", e.en ?? "Something went wrong.", e);
  }
  return data as T;
}
