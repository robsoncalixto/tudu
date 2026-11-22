"use client";

import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { CaptureDefaults } from "@/features/capture/schema";
import type { QuickAddDefaults, QuickTask } from "@/features/quick-add/schema";
import type { Dictionary } from "@/i18n";
import { errorCode } from "@/lib/http";
import { chipsAfterCapture } from "./composer-draft";
import type { Priority, Task, TaskPatch } from "./schema";
import type { Notice } from "./use-notice";

export type ComposerMode = "add" | "ai";

export type ComposerSubmission = { mode: "add"; drafts: QuickTask[] } | { mode: "ai"; text: string; defaults: QuickAddDefaults };

interface Options {
  t: Dictionary;
  today: string | null;
  ready: boolean;
  defaultPriority: Priority;
  add: (drafts: QuickTask[], priority: Priority) => { shown: Task[]; saved: Promise<Task[]> };
  capture: (text: string, today: string, defaults: CaptureDefaults, finish?: (task: Task) => TaskPatch | null) => Promise<Task[]>;
  setQuery: (query: string) => void;
  setNotice: (notice: Notice) => void;
  /** Brings a task into view, in whichever list has it. */
  show: (id: string) => void;
  fail: (code: string) => void;
  failed: QuickTask[][];
  setFailed: Dispatch<SetStateAction<QuickTask[][]>>;
  retrying: RefObject<Set<QuickTask[]>>;
}

/** How long a new row stays marked, so it can be found where the list's order put it. */
const FRESH_MS = 3000;
const NONE: ReadonlySet<string> = new Set();

/** Sends what the task field holds, by the quick-add syntax or through AI capture, and reports the outcome. */
export function useComposerSubmit({ t, today, ready, defaultPriority, add, capture, setQuery, setNotice, show, fail, failed, setFailed, retrying }: Options) {
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

  async function submit(submission: ComposerSubmission) {
    if (!today || !ready) return false;
    setNotice(null);
    try {
      if (submission.mode === "add") {
        const { shown, saved } = add(submission.drafts, defaultPriority);
        mark(shown);
        setQuery("");
        announce(await saved);
        return true;
      }
      const { text, defaults } = submission;
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
  function keep(drafts: QuickTask[]) {
    setFailed((current) => [...current, drafts]);
  }

  const next = failed[0];
  function discard() {
    setFailed((current) => current.filter((item) => item !== next));
    setNotice(null);
  }
  async function retry() {
    if (!next || retrying.current.has(next)) return;
    retrying.current.add(next);
    try {
      if (await submit({ mode: "add", drafts: next })) {
        setFailed((current) => current.filter((item) => item !== next));
      }
    } finally { retrying.current.delete(next); }
  }
  const retryNotice: Notice = next ? {
    kind: "error", text: next.length === 1 ? t.taskNotSaved(next[0].title) : t.tasksNotSaved(next.length),
    action: { label: t.retry, run: () => void retry() },
  } : null;

  return { submit, keep, fresh, retryNotice, discard };
}
