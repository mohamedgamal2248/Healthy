import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/supabase";
import { RecipeView, type RecipeContent } from "@/components/Domain";
import { VerifiedBadge } from "@/components/ui";
import { Logo } from "@/components/Icon";

export const dynamic = "force-dynamic";

/** Read-only shared recipe. Selects only recipe + author name + verified flag: never health data. */
export default async function SharedRecipe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: r } = await db().from("hl_recipes").select("title,content,username,shared").eq("id", id).maybeSingle();
  if (!r || !r.shared) notFound();
  const { data: author } = await db().from("hl_profiles").select("kyc_verified").eq("username", r.username).maybeSingle();
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-0 py-6">
      <div className="card flex items-center gap-3 !p-3.5">
        <Logo size={40} />
        <div className="min-w-0 flex-1"><p className="muted">وصفة من صحتي · Pi Healthy</p><p className="flex items-center gap-2 font-extrabold">@{r.username}{author?.kyc_verified && <VerifiedBadge small />}</p></div>
        <Link href="/" className="btn-primary btn-sm">جرّب التطبيق</Link>
      </div>
      <RecipeView content={r.content as RecipeContent} />
    </div>
  );
}
