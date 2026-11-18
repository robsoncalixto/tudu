"use client";

import { useLayoutEffect, useState } from "react";
import { errorCode } from "@/lib/http";
import { settingsApi } from "./api";
import { settingsChanges, settingsSchema, type Settings, type SettingsPatch } from "./schema";

export function useSettings(initial: Settings) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = draft.theme;
    return () => { root.dataset.theme = saved.theme; };
  }, [draft.theme, saved.theme]);

  const dirty = Object.entries(draft).some(([key, value]) => value !== saved[key as keyof Settings]);
  function change(patch: SettingsPatch) {
    setDraft((current) => ({ ...current, ...patch }));
    setSavedNotice(false);
    setError(null);
  }
  async function save() {
    if (busy || !dirty) return;
    if (!settingsSchema.safeParse(draft).success) { setError("invalid_settings"); return; }
    setBusy(true);
    setError(null);
    try {
      const next = await settingsApi.update(settingsChanges(saved, draft));
      setSaved(next);
      setDraft(next);
      setSavedNotice(true);
    } catch (error) { setError(errorCode(error)); }
    finally { setBusy(false); }
  }
  return { saved, draft, change, save, busy, error, savedNotice, dirty };
}
