import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Pwa } from "@/features/pwa/components/Pwa";
import { appColors } from "@/features/pwa/theme";
import { getSettings } from "@/features/settings/server/repository";

const heading = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-heading" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const dynamic = "force-dynamic";

export const viewport: Viewport = { viewportFit: "cover", themeColor: appColors.light };

export const metadata: Metadata = {
  title: "TUDU",
  icons: {
    icon: { url: "/brand/tudu-icon.svg", type: "image/svg+xml", sizes: "any" },
    apple: { url: "/brand/tudu-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
  description: "A to-do list that turns your notes into tasks.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, theme } = await getSettings();
  return (
    <html lang={locale} data-theme={theme} className={`${heading.variable} ${body.variable}`}>
      <body><Pwa locale={locale} />{children}</body>
    </html>
  );
}
