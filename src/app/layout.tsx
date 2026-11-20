import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { TaskWorkspace } from "@/features/tasks/components/TaskWorkspace";
import { getSettings } from "@/features/settings/server/repository";

const heading = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-heading" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TUDU",
  icons: { icon: { url: "/brand/tudu-icon.svg", type: "image/svg+xml", sizes: "any" } },
  description: "A to-do list that turns your notes into tasks.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const { locale, theme } = settings;
  return (
    <html lang={locale} data-theme={theme} className={`${heading.variable} ${body.variable}`}>
      <body><TaskWorkspace settings={settings}>{children}</TaskWorkspace></body>
    </html>
  );
}
