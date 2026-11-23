import { route, E } from "@/server/http";
import { cdnJson } from "@/server/cdn";
import { getMeal } from "@/server/meals";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(id)) throw E.notFound();
  const meal = await getMeal(id);
  if (!meal || !meal.active) throw E.notFound();
  return cdnJson({ meal }, 300, 3600);
});
