import { test, expect } from "@playwright/test";

// Read-only checks: no sign-in, nothing is created. Real Pi sign-in and payments cannot run in automation.

test("home page renders with the brand and a sign-in button", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Healthy").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Pi/ }).first()).toBeVisible();
});

test("legal and open-source pages are public and carry the PiOS notice", async ({ page }) => {
  for (const path of ["/terms", "/privacy"]) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
  }
  await page.goto("/open-source");
  await expect(page.getByText("Pi, Pi Network and the Pi logo are trademarks of the Pi Community Company.")).toBeVisible();
});

test("web app manifest and service worker are served and installable", async ({ request }) => {
  const m = await request.get("/manifest.webmanifest");
  expect(m.status()).toBe(200);
  const manifest = await m.json();
  expect(manifest.name).toBe("Healthy");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBeTruthy();
  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(await sw.text()).toContain('addEventListener("push"');
  for (const icon of ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png"]) expect((await request.get(icon)).status()).toBe(200);
});

test("public API is CDN-cacheable and contains no personal fields", async ({ request }) => {
  const r = await request.get("/api/public/meals?type=lunch");
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.meals.length).toBeGreaterThan(5);
  const c = await request.get("/api/public/community");
  expect(c.status()).toBe(200);
  const text = JSON.stringify(await c.json());
  for (const forbidden of ["pi_uid", "token_version", "cautions", "doctor_note", "liked"]) expect(text).not.toContain(forbidden);
});

test("private endpoints refuse anonymous requests", async ({ request }) => {
  for (const path of ["/api/me", "/api/today", "/api/food", "/api/community/me", "/api/duo", "/api/admin/stats"]) {
    expect((await request.get(path)).status(), path).toBe(401);
  }
  expect((await request.get("/api/cron/reminders")).status()).toBe(404); // cron is secret-only
});

test("security headers are present", async ({ request }) => {
  const r = await request.get("/");
  const h = r.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors");
  expect(h["strict-transport-security"]).toBeTruthy();
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["permissions-policy"]).toContain("camera=(self)");
});

test("signing in from an ordinary browser leads to Pi Sign-In, not a dead end", async ({ page }) => {
  await page.goto("/signin/start");
  const link = page.getByRole("link", { name: /Continue to Pi|تابع إلى Pi/ });
  await expect(link).toBeVisible();
  expect(await link.getAttribute("href")).toContain("https://accounts.pinet.com/oauth/authorize");
});
