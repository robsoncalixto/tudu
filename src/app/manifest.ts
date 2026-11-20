import type { MetadataRoute } from "next";
import { appColors } from "@/features/pwa/theme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TUDU",
    short_name: "TUDU",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: appColors.light,
    theme_color: appColors.light,
    icons: [
      { src: "/brand/tudu-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/tudu-icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/tudu-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
