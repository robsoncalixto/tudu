"use client";

import { useState } from "react";
import { errorCode } from "@/lib/http";
import { settingsApi } from "./api";
import { settingsChanges, type Settings, type SettingsPatch } from "./schema";

export function useSettings(initial: Settings) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const changes = settingsChanges(saved, draft);
  const dirty = Object.keys(changes).length > 0;
  function change(patch: SettingsPatch) {
    setDraft((current) => ({ ...current, ...patch }));
    setSavedNotice(false);
    setError(null);
  }
  async function save() {
    if (busy || !dirty) return;
    setBusy(true);
    setError(null);
    try {
      const next = await settingsApi.update(changes);
      setSaved(next);
      setDraft(next);
      setSavedNotice(true);
    } catch (error) { setError(errorCode(error)); }
    finally { setBusy(false); }
  }
  return { saved, draft, change, save, busy, error, savedNotice, dirty };
}
