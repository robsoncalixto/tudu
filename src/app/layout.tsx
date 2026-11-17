import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { getSettings } from "@/features/settings/server/repository";

const heading = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-heading" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TUDU",
  description: "A to-do list that turns your notes into tasks.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getSettings();
  return (
    <html lang={locale} className={`${heading.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
