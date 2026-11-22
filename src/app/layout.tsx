import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { Shell } from "@/components/Shell";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "Healthy",
  description: "تحدي صحي كل يوم، وجبات مصرية رخيصة وصحية، وشيف ذكاء اصطناعي ونظام غذائي شخصي لمستخدمي Pi.",
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#059669" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Script src="https://sdk.minepi.com/pi-sdk.js" strategy="afterInteractive" />
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
