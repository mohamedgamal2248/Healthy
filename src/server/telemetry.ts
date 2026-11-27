import { after } from "next/server";
import { db } from "./supabase";

/**
 * Lightweight request telemetry for the owner dashboard.
 * Every request is counted IN MEMORY (no database cost). Each server instance writes its counters in ONE batched call per
 * FLUSH_MS window, so the extra load is at most about 1 write per instance per 15 s whatever the traffic. The write is
 * best-effort and never affects a response. Counts are approximate (an instance that is recycled mid-window loses that window).
 */
const FLUSH_MS = 15_000;
const MAX_ROUTES = 120;
const MAX_ERRORS = 20;

type Row = { n: number; ms_sum: number; ms_max: number; e5: number; e4: number; slow: number };
type Err = { route: string; status: number; message: string; n: number };
type CErr = { route: string; status: number; code: string; n: number };
let rows = new Map<string, Row>();
let errs = new Map<string, Err>();
let cerrs = new Map<string, CErr>();
let flushing = false;
let scheduled = false;

/** "/api/recipes/3f2c...-uuid/like?x=1" -> "/api/recipes/:id/like" so every recipe shares one row. */
export function normalizeRoute(url: string): string {
  let path = url;
  try { path = new URL(url, "http://x").pathname; } catch { /* keep as is */ }
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/\d{2,}(?=\/|$)/g, "/:n")
    .slice(0, 80);
}

/** AI calls legitimately take many seconds; everything else is "slow" above 2.5 s. */
export function slowLimitMs(route: string): number {
  return /^\/api\/(chef|coach\/|plan$|recipes\/:id\/refine)/.test(route) ? 25_000 : 2_500;
}

export function recordRequest(url: string, method: string, status: number, ms: number, error?: unknown): void {
  const route = `${method === "GET" ? "" : `${method} `}${normalizeRoute(url)}`;
  if (route.endsWith("/api/health") || route.includes("/api/client-error")) return;
  let r = rows.get(route);
  if (!r) {
    if (rows.size >= MAX_ROUTES) return;
    r = { n: 0, ms_sum: 0, ms_max: 0, e5: 0, e4: 0, slow: 0 };
    rows.set(route, r);
  }
  r.n++; r.ms_sum += ms; r.ms_max = Math.max(r.ms_max, ms);
  if (status >= 500) r.e5++; else if (status >= 400) r.e4++;
  if (ms > slowLimitMs(route)) r.slow++;
  if (status >= 400 && status < 500) {
    // Why a request was refused (expired session, bad input, rate limit...), by error code only: never any user text.
    const code = (error as { code?: unknown } | undefined)?.code;
    const c = typeof code === "string" && /^[a-z0-9_]{1,40}$/i.test(code) ? code : `http_${status}`;
    const key = `${route}|${status}|${c}`;
    const e = cerrs.get(key);
    if (e) e.n++; else if (cerrs.size < MAX_ERRORS) cerrs.set(key, { route, status, code: c, n: 1 });
  }
  if (status >= 500) {
    const message = (error instanceof Error ? error.message : typeof error === "string" ? error : `HTTP ${status}`).replace(/\s+/g, " ").slice(0, 300);
    const key = `${route}|${status}|${message.slice(0, 80)}`;
    const e = errs.get(key);
    if (e) e.n++; else if (errs.size < MAX_ERRORS) errs.set(key, { route, status, message, n: 1 });
  }
}

/** Writes the counters in one batched call. */
export async function flushTelemetry(): Promise<void> {
  if (flushing || rows.size === 0) return;
  flushing = true;
  const batchRows = [...rows.entries()].map(([route, v]) => ({ route, ...v }));
  const batchErrs = [...errs.values()];
  const batchClient = [...cerrs.values()];
  rows = new Map(); errs = new Map(); cerrs = new Map();
  try {
    const res = await db().rpc("hl_stat_flush", { p_rows: batchRows, p_errors: batchErrs });
    if (res.error) console.error("[telemetry]", res.error.message);
    if (batchClient.length) { const r2 = await db().rpc("hl_client_err_flush", { p_errors: batchClient }); if (r2.error) console.error("[telemetry]", r2.error.message); }
  } catch (e) {
    console.error("[telemetry]", e instanceof Error ? e.message : e);
  } finally {
    flushing = false;
  }
}

/**
 * Called by the route wrapper: count in memory. The first request of a window schedules ONE flush FLUSH_MS later (after the
 * response has been sent), so everything counted in between is written together, including the tail of a quiet period.
 */
export function track(url: string, method: string, status: number, ms: number, error?: unknown): void {
  try {
    recordRequest(url, method, status, ms, error);
    if (!scheduled) {
      scheduled = true;
      after(async () => {
        await new Promise((r) => setTimeout(r, FLUSH_MS));
        scheduled = false;
        await flushTelemetry();
      });
    }
  } catch { scheduled = false; /* telemetry must never affect a response (also outside a request scope, e.g. in tests) */ }
}
