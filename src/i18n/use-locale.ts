"use client";

import { useEffect } from "react";
import { DEFAULT_LOCALE, dictionaries, type Locale } from "./index";

export function useLocale(locale: Locale = DEFAULT_LOCALE) {
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return { locale, t: dictionaries[locale] };
}
