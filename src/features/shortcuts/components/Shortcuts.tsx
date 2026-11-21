"use client";

import { useEffect, useState } from "react";
import { dictionaries, type Locale } from "@/i18n";
import { shortcutsApi } from "../api";
import { useGlobalShortcuts } from "../use-global-shortcuts";
import { ShortcutSheet } from "./ShortcutSheet";

/** Mounted once for the whole app: hears the page shortcuts and owns the help sheet. */
export function Shortcuts({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  useGlobalShortcuts();
  useEffect(() => shortcutsApi.subscribe("help", () => { setOpen(true); }), []);
  return <ShortcutSheet t={dictionaries[locale]} open={open} onClose={() => setOpen(false)} />;
}
