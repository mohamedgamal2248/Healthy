// k6 load test for the PUBLIC (CDN-cached) endpoints and the home page.
// Authenticated endpoints need a Pi session, so test those against a staging copy with ALLOW_DEV_LOGIN (see README).
//
//   k6 run -e BASE_URL=https://healthy-ai-app.vercel.app loadtest/k6-public.js
//   k6 run -e BASE_URL=... -e PROFILE=spike loadtest/k6-public.js
//
// Always run against a copy you own. Do not point it at someone else's site.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "https://healthy-ai-app.vercel.app";
const PROFILES = {
  smoke: { vus: 2, duration: "30s" },
  load: { stages: [{ duration: "1m", target: 50 }, { duration: "3m", target: 50 }, { duration: "30s", target: 0 }] },
  spike: { stages: [{ duration: "20s", target: 10 }, { duration: "20s", target: 200 }, { duration: "1m", target: 200 }, { duration: "20s", target: 0 }] },
};
export const options = {
  ...(PROFILES[__ENV.PROFILE || "smoke"]),
  thresholds: {
    http_req_failed: ["rate<0.01"],            // under 1% errors
    http_req_duration: ["p(95)<1500"],         // 95% of requests under 1.5 s
  },
};

const MEAL_QUERIES = ["", "type=lunch", "cuisine=egyptian", "type=breakfast&tags=high_protein", "q=chicken"];

export default function () {
  const q = MEAL_QUERIES[Math.floor(Math.random() * MEAL_QUERIES.length)];
  const r1 = http.get(`${BASE}/api/public/meals${q ? `?${q}` : ""}`);
  check(r1, { "meals 200": (r) => r.status === 200, "meals json": (r) => r.body && r.body.includes('"meals"') });
  const r2 = http.get(`${BASE}/api/public/community`);
  check(r2, { "community 200": (r) => r.status === 200 });
  const r3 = http.get(`${BASE}/`);
  check(r3, { "home 200": (r) => r.status === 200 });
  const r4 = http.get(`${BASE}/api/health`);
  check(r4, { "health 200": (r) => r.status === 200 });
  sleep(1);
}
