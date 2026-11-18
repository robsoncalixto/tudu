"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n";
import type { Task, TaskPatch } from "./schema";

export interface ResourceProps<T> {
  task: Task;
  t: Dictionary;
  onPatch: (id: string, changes: TaskPatch) => Promise<boolean>;
  draft?: T;
  onDraftChange?: (draft: T | undefined) => void;
}

export type ResourceMessage = "saved" | "saveFailed" | "invalidUrl" | "duplicateLink" | "linkLimit" | "linkTooLong" | "invalidDuration";

export function useResourceForm<T>({ task, onPatch, draft, onDraftChange }: ResourceProps<T>) {
  const [localDraft, setLocalDraft] = useState<T>();
  const [message, setMessage] = useState<ResourceMessage | null>(null);
  const [saving, setSaving] = useState(false);
  async function save(patch: TaskPatch) {
    setMessage(null);
    setSaving(true);
    try {
      const ok = await onPatch(task.id, patch);
      setMessage(ok ? "saved" : "saveFailed");
      return ok;
    } catch {
      setMessage("saveFailed");
      return false;
    } finally {
      setSaving(false);
    }
  }
  return { draft: onDraftChange ? draft : localDraft, edit: onDraftChange ?? setLocalDraft, save, saving, message, setMessage };
}
