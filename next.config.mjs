const isProd = process.env.NODE_ENV === "production";

// Pi Browser / Pi Sandbox embed the app in an iframe: no X-Frame-Options, and frame-ancestors
// limited to Pi domains. connect-src must allow socialchain.app (Pi SDK API calls).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://sdk.minepi.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://socialchain.app https://api.minepi.com",
  "frame-src https://sdk.minepi.com https://app-cdn.minepi.com",
  "frame-ancestors 'self' https://*.pinet.com https://*.minepi.com",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // Camera only for our own origin (meal photo scan); nothing else is requested.
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
    ];
    if (isProd) {
      base.push({ key: "Content-Security-Policy", value: csp });
      base.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
    }
    return [{ source: "/:path*", headers: base }];
  },
};
export default nextConfig;
