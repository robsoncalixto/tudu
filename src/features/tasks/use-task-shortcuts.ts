"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isTypingTarget } from "@/lib/keyboard";
import type { Task, TaskPatch } from "./schema";
import type { ShortcutDialog } from "./shortcut-schema";
import { taskShortcut } from "./task-shortcuts";

export function useTaskShortcuts(tasks: Task[] | null, patch: (id: string, patch: TaskPatch) => Promise<boolean>, remove: (id: string) => Promise<boolean>) {
  const root = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<ShortcutDialog | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const pending = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const afterClose = useRef<(() => void) | null>(null);
  const onClosed = useCallback(() => {
    const restore = afterClose.current;
    afterClose.current = null;
    const active = document.activeElement;
    requestAnimationFrame(() => {
      if (root.current && document.activeElement === active && !root.current.querySelector("dialog[open]")) restore?.();
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

  const showHelp = useCallback(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDialog({ kind: "help" });
  }, []);
  const requestDelete = useCallback((id: string) => {
    if (pending.current || dialog) return;
    const task = tasks?.find((task) => task.id === id);
    if (!task) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDeleteFailed(false);
    setDialog({ kind: "delete", id: task.id, title: task.title });
  }, [tasks, dialog]);
  const close = useCallback(() => {
    if (dialog?.kind === "delete" && pending.current) return;
    const target = returnFocus.current;
    afterClose.current = () => {
      if (target?.isConnected) target.focus();
      else if (dialog?.kind === "delete") rows().find((row) => row.dataset.taskId === dialog.id)?.focus();
    };
    setDialog(null);
  }, [dialog, rows]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLTextAreaElement && root.current?.contains(event.target)
        && event.target.closest(".composer") ? "composer" : isTypingTarget(event.target);
      const blocking = dialog !== null || Boolean(document.querySelector("dialog[open]"))
        || Boolean(root.current?.querySelector<HTMLElement>(".more-views[open]")?.getClientRects().length);
      const action = taskShortcut(event, typing, blocking);
      if (!action) return;
      if (action === "leave-composer") {
        event.preventDefault();
        const target = rows()[0] ?? root.current?.querySelector<HTMLElement>(".shortcut-help");
        target?.focus(); return;
      }
      if (action === "composer") { event.preventDefault(); focusComposer(); return; }
      if (action === "help") { event.preventDefault(); showHelp(); return; }
      const visible = rows();
      if (!visible.length) return;
      const active = document.activeElement instanceof Element ? document.activeElement.closest<HTMLElement>("[data-task-id]") : null;
      const index = active ? visible.indexOf(active) : -1;
      if (action === "next" || action === "previous") {
        event.preventDefault();
        const next = index === -1 ? action === "next" ? 0 : visible.length - 1
          : Math.max(0, Math.min(visible.length - 1, index + (action === "next" ? 1 : -1)));
        visible[next].focus(); return;
      }
      const task = tasks?.find((task) => task.id === active?.dataset.taskId);
      if (!task || !active || pending.current) return;
      event.preventDefault();
      if (action === "delete") {
        requestDelete(task.id); return;
      }
      pending.current = true;
      void patch(task.id, { done: !task.done }).then((changed) => {
        requestAnimationFrame(() => {
          // A later navigation or click must keep the focus the person chose.
          if (document.activeElement === document.body || active.contains(document.activeElement)) focusAfter(task.id, index, changed);
        });
      }).finally(() => { pending.current = false; });
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [tasks, patch, dialog, rows, focusAfter, focusComposer, showHelp, requestDelete]);

  async function confirmDelete() {
    if (dialog?.kind !== "delete" || pending.current) return;
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
  return { root, showHelp, requestDelete, dialogProps: { dialog, deleting, deleteFailed, onClose: close, onClosed, onDelete: confirmDelete } };
}
