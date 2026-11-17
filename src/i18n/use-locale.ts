"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_LOCALE, dictionaries, isLocale, type Locale } from "./index";

const STORAGE_KEY = "tudu.locale";

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (isLocale(saved)) setLocaleState(saved);
    } catch {
      // Storage can be unavailable; the default language still works.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisted; the choice still applies to this visit.
    }
  }, []);

  return { locale, setLocale, t: dictionaries[locale] };
}
