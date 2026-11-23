import { NextResponse } from "next/server";
import { db } from "@/server/supabase";

export const dynamic = "force-dynamic";

/** Uptime probe: 200 only if the app can reach its database. Exposes no details (just ok / not ok and a latency number). */
export const GET = async () => {
  const t0 = Date.now();
  try {
    const r = await db().from("hl_challenges").select("id", { head: true, count: "estimated" }).limit(1);
    if (r.error) throw new Error("db");
    return NextResponse.json({ ok: true, ms: Date.now() - t0 }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
};
