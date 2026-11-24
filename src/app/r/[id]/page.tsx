import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/supabase";
import { ContentView, type CoachContent } from "@/components/Domain";
import { SharedHeader } from "@/components/SharedHeader";
import { publicContent } from "@/server/public-content";

export const metadata = { robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

/** Read-only shared recipe. Selects only recipe + author name + verified flag: never health data. */
export default async function SharedRecipe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: r } = await db().from("hl_recipes").select("title,content,username,shared,hidden").eq("id", id).maybeSingle();
  if (!r || !r.shared || r.hidden) notFound();
  const { data: author } = await db().from("hl_profiles").select("kyc_verified,deleted_at,leaderboard_visible").eq("username", r.username).maybeSingle();
  if (author?.deleted_at) notFound();
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-0 py-6">
      <SharedHeader username={r.username} verified={!!author?.kyc_verified} />
      <ContentView content={publicContent(r.content as CoachContent)} />
    </div>
  );
}
