"use client";

import { useState } from "react";
import type { CaptureDefaults } from "@/features/capture/schema";
import type { Project } from "@/features/projects/schema";
import type { QuickAddDefaults } from "@/features/quick-add/schema";
import type { Dictionary } from "@/i18n";
import { errorCode } from "@/lib/http";
import type { Priority, Task } from "./schema";
import { isInFilter, type TaskFilter } from "./selectors";
import type { Notice } from "./use-notice";

export type ComposerMode = "add" | "ai";

interface Options {
  t: Dictionary;
  today: string | null;
  ready: boolean;
  filter: TaskFilter;
  projects: Project[];
  defaultPriority: Priority;
  add: (text: string, today: string, defaults: QuickAddDefaults, projects: Project[], priority: Priority) => { shown: Task[]; saved: Promise<Task[]> };
  capture: (text: string, today: string, defaults: CaptureDefaults) => Promise<Task[]>;
  setFilter: (filter: TaskFilter) => void;
  setQuery: (query: string) => void;
  setNotice: (notice: Notice) => void;
  fail: (code: string) => void;
}

/** Sends what the task field holds, by the quick-add syntax or through AI capture, and reports the outcome. */
export function useComposerSubmit({ t, today, ready, filter, projects, defaultPriority, add, capture, setFilter, setQuery, setNotice, fail }: Options) {
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());

  async function submit(mode: ComposerMode, text: string, defaults: QuickAddDefaults) {
    if (!today || !ready) return false;
    setNotice(null);
    try {
      if (mode === "add") {
        const { shown, saved } = add(text, today, defaults, projects, defaultPriority);
        setFresh(new Set(shown.map((task) => task.id)));
        setQuery("");
        const created = await saved;
        // A chip can send the task out of this view; say that it was still saved.
        if (created.some((task) => !isInFilter(task, filter, today))) setNotice({ kind: "ok", text: t.added(created.length) });
        return true;
      }
      const { tag, tags, projectId, plannedFor, priority, due } = defaults;
      const aiTags = [...new Set([...(tags ?? []), ...(tag ? [tag] : [])])];
      const created = await capture(text, today, {
        ...(priority ? { priority } : {}), ...(due ? { due } : {}),
        ...(projectId ? { projectId } : {}), ...(plannedFor ? { plannedFor } : {}),
        ...(aiTags.length ? { tags: aiTags } : {}),
      });
      setFresh(new Set(created.map((task) => task.id)));
      setQuery("");
      setFilter({ kind: "all" });
      setNotice({ kind: "ok", text: t.added(created.length) });
      return true;
    } catch (error) { fail(errorCode(error)); return false; }
  }

  return { submit, fresh };
}
