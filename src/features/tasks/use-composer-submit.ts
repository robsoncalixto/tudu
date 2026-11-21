"use client";

import { useEffect, useRef, useState } from "react";
import type { CaptureDefaults } from "@/features/capture/schema";
import type { Project } from "@/features/projects/schema";
import type { QuickAddDefaults } from "@/features/quick-add/schema";
import type { Dictionary } from "@/i18n";
import { errorCode } from "@/lib/http";
import { chipsAfterCapture } from "./composer-draft";
import type { Priority, Task, TaskPatch } from "./schema";
import type { Notice } from "./use-notice";

export type ComposerMode = "add" | "ai";

interface Options {
  t: Dictionary;
  today: string | null;
  ready: boolean;
  projects: Project[];
  defaultPriority: Priority;
  add: (text: string, today: string, defaults: QuickAddDefaults, projects: Project[], priority: Priority) => { shown: Task[]; saved: Promise<Task[]> };
  capture: (text: string, today: string, defaults: CaptureDefaults, finish?: (task: Task) => TaskPatch | null) => Promise<Task[]>;
  setQuery: (query: string) => void;
  setNotice: (notice: Notice) => void;
  /** Brings a task into view, in whichever list has it. */
  show: (id: string) => void;
  fail: (code: string) => void;
}

/** How long a new row stays marked, so it can be found where the list's order put it. */
const FRESH_MS = 3000;
const NONE: ReadonlySet<string> = new Set();

/** Sends what the task field holds, by the quick-add syntax or through AI capture, and reports the outcome. */
export function useComposerSubmit({ t, today, ready, projects, defaultPriority, add, capture, setQuery, setNotice, show, fail }: Options) {
  const [fresh, setFresh] = useState(NONE);
  const fading = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(fading.current), []);

  function mark(tasks: Task[]) {
    setFresh(new Set(tasks.map((task) => task.id)));
    window.clearTimeout(fading.current);
    fading.current = window.setTimeout(() => setFresh(NONE), FRESH_MS);
  }
  /** The row may have landed out of sight or in another list, so the notice names the task and leads to it. */
  function announce(created: Task[]) {
    const [first] = created;
    if (!first) return;
    setNotice({
      kind: "ok", text: created.length === 1 ? t.taskAdded(first.title) : t.added(created.length),
      action: { label: t.showTask, run: () => show(first.id) },
    });
  }

  async function submit(mode: ComposerMode, text: string, defaults: QuickAddDefaults) {
    if (!today || !ready) return false;
    setNotice(null);
    try {
      if (mode === "add") {
        const { shown, saved } = add(text, today, defaults, projects, defaultPriority);
        mark(shown);
        setQuery("");
        announce(await saved);
        return true;
      }
      const { tag, tags, projectId, plannedFor, priority, due } = defaults;
      const aiTags = [...new Set([...(tags ?? []), ...(tag ? [tag] : [])])];
      const created = await capture(text, today, {
        ...(priority ? { priority } : {}), ...(due ? { due } : {}),
        ...(projectId ? { projectId } : {}), ...(plannedFor ? { plannedFor } : {}),
        ...(aiTags.length ? { tags: aiTags } : {}),
      }, (task) => chipsAfterCapture(defaults, task, today));
      mark(created);
      setQuery("");
      announce(created);
      return true;
    } catch (error) { fail(errorCode(error)); return false; }
  }

  /**
   * A save failed while the field already held the next task. Mixing the two would give one's chips to
   * the other, so the task that failed waits in the notice, to be sent again as it was.
   */
  function keep(text: string, defaults: QuickAddDefaults, titles: string[]) {
    setNotice({
      kind: "error", text: titles.length === 1 ? t.taskNotSaved(titles[0]) : t.tasksNotSaved(titles.length),
      action: { label: t.retry, run: () => { void submit("add", text, defaults).then((saved) => { if (!saved) keep(text, defaults, titles); }); } },
    });
  }

  return { submit, keep, fresh };
}
