import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireUser } from "@/server/auth";

/** Server-side sign-out: bumps token_version so every token issued so far (incl. a stolen one) stops working. */
export const POST = route(async (req) => {
  const a = await requireUser(req);
  must(await db().from("hl_profiles").update({ token_version: (a.profile.token_version ?? 0) + 1 }).eq("username", a.username));
  return ok({ ok: true });
});
