import { db } from "./supabase";

/** Append-only trail of admin actions (who changed what). Never blocks the action itself. */
export async function audit(admin: string, action: string, target?: string, payload?: unknown): Promise<void> {
  try {
    await db().from("hl_admin_audit").insert({ admin, action, target: target ?? null, payload: payload ?? null });
  } catch (e) {
    console.error("[audit]", e);
  }
}
