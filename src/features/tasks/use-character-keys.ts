"use client";

import { useEffect, useState } from "react";
import { shortcutsApi } from "@/features/shortcuts/api";

/** Whether single-key shortcuts are on for this device, for hints that should name only keys that work. */
export function useCharacterKeys(): boolean {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    const read = () => setEnabled(shortcutsApi.charactersEnabled());
    read();
    return shortcutsApi.watchCharacters(read);
  }, []);
  return enabled;
}
