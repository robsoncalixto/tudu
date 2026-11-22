"use client";

import { useEffect, useRef } from "react";
import { shortcutsApi } from "@/features/shortcuts/api";
import type { Task } from "./schema";

interface Options {
  tasks: Task[] | null;
  /** Rows the person can see, in order. */
  rows: () => HTMLElement[];
  focusComposer: () => void;
  focusSearch: () => void;
  onToggle: (task: Task) => void;
  onDelete: (id: string) => void;
  onUndo: () => boolean;
  /** Escape with a task in focus; false when there is nothing to step back from. */
  onBack: () => boolean;
}

/** Connects the page shortcuts to the board. A handler returns false when it has nothing to act on. */
export function useTaskShortcuts(options: Options) {
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    const rowOf = (target: HTMLElement | null) => target?.closest<HTMLElement>("[data-task-id]") ?? null;
    function onTask(target: HTMLElement | null, act: (task: Task, row: HTMLElement) => void) {
      const row = rowOf(target);
      const task = latest.current.tasks?.find((item) => item.id === row?.dataset.taskId);
      if (!row || !task) return false;
      act(task, row);
    }
    function move(target: HTMLElement | null, step: 1 | -1) {
      const visible = latest.current.rows();
      if (!visible.length) return false;
      const row = rowOf(target);
      const index = row ? visible.indexOf(row) : -1;
      const next = index === -1 ? (step === 1 ? 0 : visible.length - 1) : Math.max(0, Math.min(visible.length - 1, index + step));
      visible[next].focus();
    }
    const press = (row: HTMLElement, selector: string) => row.querySelector<HTMLButtonElement>(selector)?.click();
    const stops = [
      shortcutsApi.subscribe("newTask", () => latest.current.focusComposer()),
      shortcutsApi.subscribe("search", () => latest.current.focusSearch()),
      shortcutsApi.subscribe("undo", () => latest.current.onUndo()),
      shortcutsApi.subscribe("nextTask", (target) => move(target, 1)),
      shortcutsApi.subscribe("previousTask", (target) => move(target, -1)),
      shortcutsApi.subscribe("toggleTask", (target) => onTask(target, (task) => latest.current.onToggle(task))),
      shortcutsApi.subscribe("editTask", (target) => onTask(target, (_, row) => press(row, "button.task-title"))),
      shortcutsApi.subscribe("openTask", (target) => onTask(target, (_, row) => press(row, "button.task-disclosure"))),
      shortcutsApi.subscribe("deleteTask", (target) => onTask(target, (task) => latest.current.onDelete(task.id))),
      shortcutsApi.subscribe("backToList", () => latest.current.onBack()),
    ];
    return () => stops.forEach((stop) => stop());
  }, []);
}
