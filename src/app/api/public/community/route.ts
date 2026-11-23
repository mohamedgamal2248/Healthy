import { route } from "@/server/http";
import { cdnJson } from "@/server/cdn";
import { publicCommunity } from "@/server/community";
import { memo } from "@/server/memo";
import { DEFAULT_TZ, localDate } from "@/lib/dates";

/** Leaderboards, teams and shared recipes: identical for everyone, so it is cached on the CDN for a minute. */
export const dynamic = "force-dynamic";
export const GET = route(async () => {
  const today = localDate(DEFAULT_TZ);
  return cdnJson(await memo(`public-community:${today}`, 30_000, () => publicCommunity(today)), 60, 300);
});
