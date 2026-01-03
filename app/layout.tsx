import type { Metadata, Viewport } from "next";
import { Noto_Kufi_Arabic, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const notoKufiArabic = Noto_Kufi_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "سبحة صوتية | Voice Tasbih Counter",
  description: "عداد سبحة بالصوت — احصِ أذكارك بصوتك بسهولة",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "سبحة صوتية",
  },
  applicationName: "سبحة صوتية",
  keywords: ["سبحة", "أذكار", "تسبيح", "dhikr", "tasbih", "counter", "voice"],
  authors: [{ name: "Voice Subha" }],
  creator: "Voice Subha",
  openGraph: {
    type: "website",
    locale: "ar_EG",
    title: "سبحة صوتية | Voice Tasbih Counter",
    description: "عداد سبحة بالصوت — احصِ أذكارك بصوتك بسهولة",
    siteName: "سبحة صوتية",
  },
  twitter: {
    card: "summary",
    title: "سبحة صوتية | Voice Tasbih Counter",
    description: "عداد سبحة بالصوت — احصِ أذكارك بصوتك بسهولة",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#10b981" },
    { media: "(prefers-color-scheme: dark)", color: "#1f2937" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${outfit.variable} ${notoKufiArabic.variable} font-arabic antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}