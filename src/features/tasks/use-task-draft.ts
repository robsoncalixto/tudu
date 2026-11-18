"use client";

import { useState } from "react";

export function updateTaskDraft<T>(current: Map<string, T>, id: string, previous: T | undefined, value: T | undefined) {
  // Late saves must not clear text entered after returning to this task.
  if (value === undefined && current.get(id) !== previous) return current;
  const next = new Map(current);
  if (value === undefined) next.delete(id);
  else next.set(id, value);
  return next;
}

export function useTaskDraft<T>(id: string) {
  const [drafts, setDrafts] = useState(new Map<string, T>());
  const draft = drafts.get(id);
  function onDraftChange(value: T | undefined) {
    setDrafts((current) => updateTaskDraft(current, id, draft, value));
  }
  return { draft, onDraftChange };
}
