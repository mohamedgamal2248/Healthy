import { NextResponse } from "next/server";

/**
 * Response for data that is IDENTICAL for every visitor (no per-user fields, no auth).
 * Vercel's CDN keeps it for `sMaxAge` seconds and serves stale copies while refreshing, so the
 * server and database are touched about once per window instead of once per request.
 * Never use this for anything that depends on who is asking.
 */
export function cdnJson<T>(data: T, sMaxAge = 60, swr = 300) {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
      "X-Robots-Tag": "noindex",
    },
  });
}
