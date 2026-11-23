/** Tiny per-instance TTL cache with in-flight de-duplication: N concurrent callers share ONE database query. */
const store = new Map<string, { at: number; v: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export async function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = fn().then((v) => { store.set(key, { at: Date.now(), v }); if (store.size > 500) store.delete(store.keys().next().value as string); return v; }).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
