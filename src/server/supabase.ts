import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { E } from "./http";

let client: SupabaseClient | null = null;

/** Service-role client. Server-only: the browser never talks to Supabase directly. */
export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw E.notConfigured("قاعدة البيانات");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Throw on a Supabase error, return data otherwise. */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) {
    console.error("[db]", res.error.message);
    throw new Error(res.error.message);
  }
  return res.data as T;
}
