"use client";

import { useEffect } from "react";
import type { Settings } from "@/features/settings/schema";
import type { Locale } from "@/i18n";
import { appColors } from "../theme";

export function Pwa({ locale, theme }: { locale: Locale; theme: Settings["theme"] }) {
  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const root = document.documentElement;
    function update() {
      for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
        const dark = root.dataset.theme === "dark" || (root.dataset.theme === "system" &&
          (meta.media ? meta.media.includes("dark") : system.matches));
        meta.content = dark ? appColors.dark : appColors.light;
      }
    }
    update();
    system.addEventListener("change", update);
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { system.removeEventListener("change", update); observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (!window.isSecureContext || !("serviceWorker" in navigator)) return;
    const workers = navigator.serviceWorker;
    let active = true;
    const syncLocale = () => {
      if (active) workers.controller?.postMessage({ locale, theme });
    };
    workers.addEventListener("controllerchange", syncLocale);
    void workers.register("/sw.js").then(async () => {
      const registration = await workers.ready;
      if (active) registration.active?.postMessage({ locale, theme });
    }).catch(() => undefined);
    return () => { active = false; workers.removeEventListener("controllerchange", syncLocale); };
  }, [locale, theme]);

  return null;
}
