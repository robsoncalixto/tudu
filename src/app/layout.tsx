import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { TaskWorkspace } from "@/features/tasks/components/TaskWorkspace";
import { Pwa } from "@/features/pwa/components/Pwa";
import { appColors } from "@/features/pwa/theme";
import { getSettings } from "@/features/settings/server/repository";

const heading = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-heading" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const dynamic = "force-dynamic";

export async function generateViewport(): Promise<Viewport> {
  const { theme } = await getSettings();
  return { viewportFit: "cover", themeColor: theme === "system" ? [
    { media: "(prefers-color-scheme: light)", color: appColors.light },
    { media: "(prefers-color-scheme: dark)", color: appColors.dark },
  ] : appColors[theme] };
}

export const metadata: Metadata = {
  title: "TUDU",
  icons: {
    icon: { url: "/brand/tudu-icon.svg", type: "image/svg+xml", sizes: "any" },
    apple: { url: "/brand/tudu-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
  description: "A to-do list that turns your notes into tasks.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const { locale, theme } = settings;
  return (
    <html lang={locale} data-theme={theme} className={`${heading.variable} ${body.variable}`}>
      <body>
        <Pwa locale={locale} theme={theme} />
        <TaskWorkspace settings={settings}>{children}</TaskWorkspace>
      </body>
    </html>
  );
}
