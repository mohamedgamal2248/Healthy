import { db, must } from "@/server/supabase";
import { HttpError, ok, readJson, route, E } from "@/server/http";
import { requireDisclaimer, requireVerified } from "@/server/auth";
import { aiConfigured, AiNotConfigured, type AiMessage } from "@/server/ai/provider";
import { answerFollowUp } from "@/server/ai/recipe";
import { isRefusalRequest } from "@/server/ai/safety";
import { refusal, type RecipeContent } from "@/server/chef";

export const maxDuration = 300;
const DAILY_FOLLOWUP_CAP = 20; // protects provider cost; follow-ups never deduct credits

/** Free follow-up on the user's own recipe thread: no credit is deducted. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const a = await requireVerified(req);
  requireDisclaimer(a);
  const { id } = await params;
  const { question } = await readJson<{ question?: string }>(req);
  const q = (question ?? "").trim();
  if (q.length < 2 || q.length > 400) throw E.bad("اكتب سؤالك باختصار.", "Keep your question short.");
  if (isRefusalRequest(q)) throw refusal();
  if (!aiConfigured()) throw E.notConfigured("الشيف AI");

  const r = must(await db().from("hl_recipes").select("id,username,content").eq("id", id).maybeSingle()) as { username: string; content: RecipeContent } | null;
  if (!r || r.username !== a.username) throw E.notFound();

  const since = new Date(Date.now() - 86400000).toISOString();
  const cnt = await db().from("hl_ai_requests").select("id", { count: "exact", head: true }).eq("username", a.username).eq("type", "follow-up").gte("created_at", since);
  if ((cnt.count ?? 0) >= DAILY_FOLLOWUP_CAP) throw new HttpError(429, "rate_limited", "وصلت للحد اليومي من الأسئلة. جرّب غدًا.", "Daily follow-up limit reached. Try again tomorrow.");

  const history = (must(await db().from("hl_recipe_messages").select("role,content").eq("recipe_id", id).order("created_at").limit(12)) as AiMessage[]) ?? [];
  const log = must(await db().from("hl_ai_requests").insert({ username: a.username, type: "follow-up", input_summary: q.slice(0, 200), credit_cost: 0, status: "pending" }).select("id").single()) as { id: string };
  try {
    const answer = await answerFollowUp(r.content.recipe, history, q, { goal: a.profile.goal, conditions: a.profile.conditions });
    must(await db().from("hl_recipe_messages").insert([{ recipe_id: id, username: a.username, role: "user", content: q }, { recipe_id: id, username: a.username, role: "assistant", content: answer }]));
    must(await db().from("hl_ai_requests").update({ status: "completed" }).eq("id", log.id));
    return ok({ answer });
  } catch (e) {
    must(await db().from("hl_ai_requests").update({ status: "failed", error: e instanceof Error ? e.message.slice(0, 120) : "failed" }).eq("id", log.id));
    if (e instanceof AiNotConfigured) throw E.notConfigured("الشيف AI");
    throw new HttpError(502, "ai_failed", "تعذّر الرد الآن. حاول مرة أخرى (لم يُخصم أي كريدت).", "Couldn't answer right now. Try again (no credit was used).");
  }
});
