"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { nextDueDate } from "./recurrence";
import type { Task, TaskPatch } from "./schema";
import type { Notice } from "./use-notice";

interface Options {
  tasks: Task[] | null;
  patch: (id: string, changes: TaskPatch) => Promise<boolean>;
  changeLater: (id: string, changes: TaskPatch | null) => { undo: () => boolean; commit: () => Promise<boolean> };
  notify: (notice: Notice) => void;
  labels: {
    completed: (title: string) => string; reopened: (title: string) => string;
    deleted: (title: string) => string; restored: (title: string) => string;
    /** Says when the next task of a repeating one is due. */
    next: (due: string) => string;
    /** Says the due date a task has now, or that it has none. */
    due: (title: string, due: string | null) => string;
  };
  /** The task is leaving the board, so anything open on it closes. */
  onLeave: (id: string) => void;
  /** A task to show is not in the list on screen, so the board changes to the list that has every task. */
  onElsewhere: () => void;
}

/** One action that Undo can take back. */
interface Step {
  id: string;
  /** What the notice says while this is the action Undo would take back. */
  text: string;
  /** What it says once the action was taken back. */
  undone: string;
  undo: () => void;
  /** Saves a change that was only shown so far. */
  commit?: () => void;
  /** A completion or reopening which has only changed the visible list so far. */
  heldDone?: boolean;
  /** The due date before a run of changes to it, which are taken back as one. */
  from?: string | null;
}

/** Enough to take back a run of quick actions; older ones are saved as newer ones arrive. */
const MAX_STEPS = 8;

/** Draws the eye to a row the person asked to see. */
function point(row: HTMLElement) {
  row.focus();
  row.scrollIntoView({ block: "nearest" });
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const tint = getComputedStyle(row).getPropertyValue("--selected-surface").trim();
  if (tint) row.animate?.([{ backgroundColor: tint }, { backgroundColor: "transparent" }], { duration: 1600, easing: "ease-out" });
}

/**
 * Completing and deleting from the list. Both happen at once and can be taken back one after the other,
 * newest first, for as long as the notice shows. The keyboard stays on a sensible row throughout.
 */
export function useTaskActions(options: Options) {
  const root = useRef<HTMLDivElement>(null);
  const rowFocus = useRef<{ id: string; index: number; row: HTMLElement; always: boolean } | null>(null);
  const reveal = useRef<{ id: string; point: boolean } | null>(null);
  const history = useRef<Step[]>([]);
  const handing = useRef(false);
  const latest = useRef(options);
  latest.current = options;
  const [, look] = useState(0);

  const rows = useCallback(() => Array.from(root.current?.querySelectorAll<HTMLElement>("[data-task-id]") ?? [])
    .filter((row) => !row.closest("details:not([open])") && row.getClientRects().length > 0), []);
  const focusComposer = useCallback(() => root.current?.querySelector<HTMLTextAreaElement>(".composer textarea")?.focus(), []);
  const focusAfter = useCallback((id: string, index: number) => {
    const visible = rows();
    const candidates = visible.filter((row) => row.dataset.taskId !== id);
    const target = candidates[Math.min(index, candidates.length - 1)] ?? visible[0]
      // With no row left the keyboard stays on the board, where the undo key still works, not in the task field.
      ?? root.current?.querySelector<HTMLElement>(".empty-action") ?? root.current?.querySelector<HTMLElement>("main");
    target?.focus();
  }, [rows]);

  /** Remembers where a row sits, so focus can move on if the change takes it out of view. */
  const leaving = useCallback((id: string, always: boolean) => {
    const visible = rows();
    const index = visible.findIndex((row) => row.dataset.taskId === id);
    const row = visible[index];
    const active = document.activeElement;
    // A title editor commits on blur, when the browser can already report body.
    rowFocus.current = row && (always || row.contains(active) || active === document.body) ? { row, id, index, always } : null;
  }, [rows]);

  const steps = useMemo(() => {
    /** The notice went away for good: what was only shown is saved, and nothing is left to take back. */
    function settle() {
      // Replaced by the next step of the same run, so nothing is final yet.
      if (handing.current) return;
      const waiting = history.current;
      history.current = [];
      for (const step of waiting) step.commit?.();
    }
    /** Puts the newest step in the notice, after saying what was just taken back, if anything. */
    function present(undone?: string) {
      const last = history.current.at(-1);
      handing.current = true;
      latest.current.notify(last ? { kind: "ok", text: undone ? `${undone} ${last.text}` : last.text, undo, onGone: settle }
        : undone ? { kind: "ok", text: undone } : null);
      handing.current = false;
    }
    function undo() {
      const step = history.current.pop();
      if (!step) return;
      step.undo();
      reveal.current = { id: step.id, point: false };
      present(step.undone);
    }
    function record(step: Step) {
      history.current.push(step);
      if (history.current.length > MAX_STEPS) history.current.shift()?.commit?.();
      present();
    }
    /** Takes a step out of the run, wherever it is, and takes it back. */
    function withdraw(step: Step, undone: string) {
      history.current = history.current.filter((item) => item !== step);
      step.undo();
      present(undone);
    }
    return { record, withdraw, present };
  }, []);

  const patchFromRow = useCallback((id: string, changes: TaskPatch) => {
    const { tasks, patch, changeLater, labels } = latest.current;
    leaving(id, false);
    const task = tasks?.find((item) => item.id === id);
    const title = task?.title ?? "";
    if (task && changes.due !== undefined && Object.keys(changes).length === 1) {
      // A date stepped with the arrow keys or retyped is one change to take back, not one for every key.
      const last = history.current.at(-1);
      const running = last?.id === id && last.from !== undefined;
      const from = running ? last.from ?? null : task.due;
      if (running) history.current.pop();
      const saved = patch(id, changes);
      if (changes.due === from) steps.present();
      else steps.record({ id, from, text: labels.due(title, changes.due), undone: labels.due(title, from), undo: () => { void latest.current.patch(id, { due: from }); } });
      return saved;
    }
    if (changes.done === undefined) return patch(id, changes);
    const done = changes.done;
    const held = history.current.findLast((step) => step.id === id && step.heldDone === !done);
    const text = done ? labels.completed(title) : labels.reopened(title);
    const undone = done ? labels.reopened(title) : labels.completed(title);
    if (held) { steps.withdraw(held, text); return Promise.resolve(true); }
    let next: string | null = null;
    try { next = done && task?.repeat && task.due && !task.nextOccurrenceId ? nextDueDate(task.due, task.repeat) : null; } catch { next = null; }
    if (!done || next || (task && Object.keys(task.dayRanks).length > 0)) {
      // Undo must preserve completion history, recurring occurrences, and saved positions in Today.
      const later = changeLater(id, changes);
      steps.record({
        id, heldDone: done, text: next ? `${text} ${labels.next(next)}` : text, undone,
        undo: () => { later.undo(); }, commit: () => { void later.commit(); },
      });
      return Promise.resolve(true);
    }
    const saved = patch(id, changes);
    steps.record({
      id, text, undone,
      undo: () => { void latest.current.patch(id, { done: !done }); },
    });
    return saved;
  }, [leaving, steps]);

  const requestDelete = useCallback((id: string) => {
    const { tasks, changeLater, labels, onLeave } = latest.current;
    const task = tasks?.find((item) => item.id === id);
    if (!task) return;
    leaving(id, true);
    onLeave(id);
    // Nothing is deleted until the chance to undo has passed.
    const later = changeLater(id, null);
    steps.record({
      id, text: labels.deleted(task.title), undone: labels.restored(task.title),
      undo: () => { later.undo(); }, commit: () => { void later.commit(); },
    });
  }, [leaving, steps]);

  /** Brings a task into view and puts the keyboard on it, changing list when this one does not have it. */
  const show = useCallback((id: string) => {
    const row = rows().find((item) => item.dataset.taskId === id);
    if (row) { point(row); return; }
    reveal.current = { id, point: true };
    latest.current.onElsewhere();
    look((count) => count + 1);
  }, [rows]);

  useLayoutEffect(() => {
    // One try: a task undone into a closed section must not pull focus when that section opens later.
    const wanted = reveal.current;
    const restored = wanted && rows().find((row) => row.dataset.taskId === wanted.id);
    reveal.current = null;
    if (restored && wanted?.point) point(restored);
    else if (restored) restored.focus();
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
  });

  return { root, rows, focusComposer, requestDelete, patchFromRow, show };
}
