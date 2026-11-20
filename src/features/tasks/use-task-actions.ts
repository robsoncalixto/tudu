"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import type { Notice } from "./components/TaskWorkspace";
import type { Task, TaskPatch } from "./schema";

interface Options {
  tasks: Task[] | null;
  patch: (id: string, changes: TaskPatch) => Promise<boolean>;
  removeLater: (id: string) => { undo: () => boolean; commit: () => Promise<boolean> };
  notify: (notice: Notice) => void;
  labels: { completed: string; reopened: string; deleted: string; undo: string };
  /** The task is leaving the board, so anything open on it closes. */
  onLeave: (id: string) => void;
}

/** Completing and deleting from the list: both happen at once, offer Undo, and keep the keyboard on a sensible row. */
export function useTaskActions({ tasks, patch, removeLater, notify, labels, onLeave }: Options) {
  const root = useRef<HTMLDivElement>(null);
  const rowFocus = useRef<{ id: string; index: number; row: HTMLElement; always: boolean } | null>(null);
  const reveal = useRef<string | null>(null);

  const rows = useCallback(() => Array.from(root.current?.querySelectorAll<HTMLElement>("[data-task-id]") ?? [])
    .filter((row) => !row.closest("details:not([open])") && row.getClientRects().length > 0), []);
  const focusComposer = useCallback(() => root.current?.querySelector<HTMLTextAreaElement>(".composer textarea")?.focus(), []);
  const focusAfter = useCallback((id: string, index: number) => {
    const visible = rows();
    const candidates = visible.filter((row) => row.dataset.taskId !== id);
    const target = candidates[Math.min(index, candidates.length - 1)];
    if (target) target.focus();
    else if (visible.length) visible[0].focus();
    else focusComposer();
  }, [rows, focusComposer]);

  /** Remembers where a row sits, so focus can move on if the change takes it out of view. */
  const leaving = useCallback((id: string, always: boolean) => {
    const visible = rows();
    const index = visible.findIndex((row) => row.dataset.taskId === id);
    const row = visible[index];
    const active = document.activeElement;
    // A title editor commits on blur, when the browser can already report body.
    rowFocus.current = row && (always || row.contains(active) || active === document.body) ? { row, id, index, always } : null;
  }, [rows]);

  const patchFromRow = useCallback((id: string, changes: TaskPatch) => {
    leaving(id, false);
    const saved = patch(id, changes);
    if (changes.done !== undefined) {
      const done = changes.done;
      notify({
        kind: "ok", text: done ? labels.completed : labels.reopened,
        action: { label: labels.undo, run: () => { reveal.current = id; notify(null); void patch(id, { done: !done }); } },
      });
    }
    return saved;
  }, [patch, leaving, notify, labels]);

  const requestDelete = useCallback((id: string) => {
    if (!tasks?.some((task) => task.id === id)) return;
    leaving(id, true);
    onLeave(id);
    const held = removeLater(id);
    notify({
      kind: "ok", text: labels.deleted,
      action: { label: labels.undo, run: () => { if (held.undo()) reveal.current = id; notify(null); } },
      // Nothing is deleted until the chance to undo has passed.
      onGone: () => { void held.commit(); },
    });
  }, [tasks, leaving, onLeave, removeLater, notify, labels]);

  useLayoutEffect(() => {
    // One try: a task undone into a closed section must not pull focus when that section opens later.
    const restored = reveal.current && rows().find((row) => row.dataset.taskId === reveal.current);
    reveal.current = null;
    if (restored) restored.focus();
    const origin = rowFocus.current;
    rowFocus.current = null;
    if (!origin || origin.row.isConnected) return;
    const settle = () => {
      if ((origin.always || document.activeElement === document.body) && root.current && !document.querySelector("dialog:modal")) {
        focusAfter(origin.id, origin.index);
      }
    };
    // A deletion moves on in the same commit; other changes wait for the browser to settle the blur.
    if (origin.always) settle();
    else requestAnimationFrame(settle);
  }, [tasks, focusAfter, rows]);

  return { root, rows, focusComposer, requestDelete, patchFromRow };
}
