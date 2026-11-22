import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/supabase";
import { ContentView, type CoachContent } from "@/components/Domain";
import { VerifiedBadge } from "@/components/ui";
import { Logo } from "@/components/Icon";

export const dynamic = "force-dynamic";

/** Read-only shared recipe. Selects only recipe + author name + verified flag: never health data. */
const lang = "ar" as "ar" | "en"; // public page: Arabic-first; the app itself handles the toggle
export default async function SharedRecipe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: r } = await db().from("hl_recipes").select("title,content,username,shared").eq("id", id).maybeSingle();
  if (!r || !r.shared) notFound();
  const { data: author } = await db().from("hl_profiles").select("kyc_verified").eq("username", r.username).maybeSingle();
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-0 py-6">
      <div className="card !p-4">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div className="min-w-0 flex-1">
            <p className="muted">{lang === "ar" ? "وصفة من" : "Recipe from"} <b className="text-ink" dir="ltr">Healthy</b></p>
            <p className="flex flex-wrap items-center gap-2 font-extrabold"><bdi dir="ltr" className="break-all">@{r.username}</bdi>{author?.kyc_verified && <VerifiedBadge small />}</p>
          </div>
        </div>
        <Link href="/" className="btn-primary mt-3 w-full">{lang === "ar" ? "جرّب التطبيق" : "Try the app"}</Link>
      </div>
      <ContentView content={r.content as CoachContent} />
    </div>
  );
}
