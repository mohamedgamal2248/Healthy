import { route } from "@/server/http";
import { cdnJson } from "@/server/cdn";
import { listMeals } from "@/server/meals";

const CUISINES = new Set(["egyptian", "international"]);
const TYPES = new Set(["breakfast", "lunch", "dinner"]);

/** The meal catalogue is the same for everyone. Inputs are validated and normalised so equal searches share one CDN entry. */
export const GET = route(async (req) => {
  const u = new URL(req.url);
  const list = (k: string) => [...new Set((u.searchParams.get(k) ?? "").split(",").map((s) => s.trim().toLowerCase()).filter((s) => /^[a-z0-9_-]{1,40}$/.test(s)))].sort().slice(0, 30);
  const cuisine = u.searchParams.get("cuisine") ?? "";
  const type = u.searchParams.get("type") ?? "";
  const have = list("have");
  const q = (u.searchParams.get("q") ?? "").trim().slice(0, 60);
  const meals = await listMeals({ cuisine: CUISINES.has(cuisine) ? cuisine : undefined, type: TYPES.has(type) ? type : undefined, tags: list("tags"), have: have.length ? have : undefined, q: q || undefined });
  return cdnJson({ meals }, 300, 3600);
});
