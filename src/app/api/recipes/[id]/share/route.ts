import { db, must } from "@/server/supabase";
import { ok, readJson, route, E } from "@/server/http";
import { requireUser } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";

/** Share outside Pi Browser: the PiNet link shows the recipe read-only (no profile data). */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const a = await requireUser(req);
  await rateLimit("share", a.username, 60, 3600);
  const { id } = await params;
  const { shared } = await readJson<{ shared?: boolean }>(req);
  const r = must(await db().from("hl_recipes").select("id,username,content").eq("id", id).maybeSingle()) as { username: string; content: { kind?: string } } | null;
  if (!r || r.username !== a.username) throw E.notFound();
  // Only text recipes can be published (not photo analyses, workouts or challenges).
  if (r.content?.kind && r.content.kind !== "recipe") throw E.bad("هذا النوع لا يمكن نشره.", "This item type cannot be published.");
  const on = shared !== false;
  must(await db().from("hl_recipes").update({ shared: on, shared_at: on ? new Date().toISOString() : null }).eq("id", id));
  const base = (process.env.NEXT_PUBLIC_PINET_URL || new URL(req.url).origin).replace(/\/$/, "");
  return ok({ shared: on, url: on ? `${base}/r/${id}` : null });
});
