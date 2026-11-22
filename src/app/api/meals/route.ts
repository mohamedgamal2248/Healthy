import { ok, route } from "@/server/http";
import { requireUser } from "@/server/auth";
import { listMeals } from "@/server/meals";

export const GET = route(async (req) => {
  await requireUser(req);
  const u = new URL(req.url);
  const list = (k: string) => (u.searchParams.get(k) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const have = list("have");
  return ok({ meals: await listMeals({ cuisine: u.searchParams.get("cuisine") ?? undefined, type: u.searchParams.get("type") ?? undefined, tags: list("tags"), have: have.length ? have : undefined, q: u.searchParams.get("q") ?? undefined }) });
});
