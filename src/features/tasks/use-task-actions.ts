"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Task, TaskPatch } from "./schema";

export function useTaskActions(tasks: Task[] | null, patch: (id: string, patch: TaskPatch) => Promise<boolean>, remove: (id: string) => Promise<boolean>) {
  const root = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<Pick<Task, "id" | "title"> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const pending = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const rowFocus = useRef<{ id: string; index: number; row: HTMLElement } | null>(null);
  const afterClose = useRef<(() => void) | null>(null);
  const onClosed = useCallback(() => {
    const restore = afterClose.current;
    afterClose.current = null;
    const active = document.activeElement;
    requestAnimationFrame(() => {
      if (root.current && document.activeElement === active && !root.current.querySelector("dialog[open]:not(.inspector-host)")) restore?.();
    });
  }, []);

  const rows = useCallback(() => Array.from(root.current?.querySelectorAll<HTMLElement>("[data-task-id]") ?? [])
    .filter((row) => !row.closest("details:not([open])") && row.getClientRects().length > 0), []);
  const focusComposer = useCallback(() => root.current?.querySelector<HTMLTextAreaElement>(".composer textarea")?.focus(), []);
  const focusAfter = useCallback((id: string, index: number, changed: boolean) => {
    const visible = rows();
    const candidates = changed ? visible.filter((row) => row.dataset.taskId !== id) : visible;
    const target = !changed ? visible.find((row) => row.dataset.taskId === id) : candidates[Math.min(index, candidates.length - 1)];
    if (target) target.focus();
    else if (visible.length) visible[0].focus();
    else focusComposer();
  }, [rows, focusComposer]);

  const patchFromRow = useCallback((id: string, changes: TaskPatch) => {
    const visible = rows();
    const index = visible.findIndex((row) => row.dataset.taskId === id);
    const row = visible[index];
    const active = document.activeElement;
    // A title editor commits on blur, when the browser can already report body.
    rowFocus.current = row && (row.contains(active) || active === document.body) ? { row, id, index } : null;
    return patch(id, changes);
  }, [patch, rows]);

  useLayoutEffect(() => {
    const origin = rowFocus.current;
    rowFocus.current = null;
    if (!origin || origin.row.isConnected) return;
    requestAnimationFrame(() => {
      if (document.activeElement === document.body && root.current && !root.current.querySelector("dialog[open]:not(.inspector-host)")) {
        focusAfter(origin.id, origin.index, true);
      }
    });
  }, [tasks, focusAfter]);

  const requestDelete = useCallback((id: string) => {
    if (pending.current || dialog) return;
    const task = tasks?.find((task) => task.id === id);
    if (!task) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDeleteFailed(false);
    setDialog({ id: task.id, title: task.title });
  }, [tasks, dialog]);
  const close = useCallback(() => {
    if (pending.current) return;
    const target = returnFocus.current;
    afterClose.current = () => {
      if (target?.isConnected) target.focus();
      else if (dialog) rows().find((row) => row.dataset.taskId === dialog.id)?.focus();
    };
    setDialog(null);
  }, [dialog, rows]);

  async function confirmDelete() {
    if (!dialog || pending.current) return;
    const id = dialog.id;
    const index = rows().findIndex((row) => row.dataset.taskId === id);
    pending.current = true; setDeleting(true); setDeleteFailed(false);
    try {
      if (await remove(id)) {
        afterClose.current = () => focusAfter(id, Math.max(0, index), true);
        setDialog(null);
      } else setDeleteFailed(true);
    } finally { pending.current = false; setDeleting(false); }
  }
  return { root, requestDelete, patchFromRow, dialogProps: { dialog, deleting, deleteFailed, onClose: close, onClosed, onDelete: confirmDelete } };
}
