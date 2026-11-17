import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const heading = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-heading" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "TUDU",
  description: "A to-do list that turns your notes into tasks.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
