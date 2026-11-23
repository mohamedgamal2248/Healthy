import { defineConfig } from "@playwright/test";

// Smoke tests against a running copy of the site. Default target: production (read-only checks only).
//   E2E_BASE_URL=http://localhost:3000 npx playwright test -c e2e --trace off
export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "https://healthy-ai-app.vercel.app",
    trace: "off",
    launchOptions: process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM, args: ["--no-sandbox"] } : { args: ["--no-sandbox"] },
  },
  projects: [
    { name: "phone", use: { viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36" } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
});
