"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Dictionary } from "@/i18n";
import { Icon } from "@/lib/Icon";

export function TaskContextMenu({ board, t }: { board: RefObject<HTMLDivElement | null>; t: Dictionary }) {
  const menu = useRef<HTMLDivElement>(null);
  const parent = useRef<HTMLElement | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const root = board.current;
    const popup = menu.current;
    if (!root || !popup || typeof popup.showPopover !== "function") return;

    function open(event: MouseEvent | KeyboardEvent) {
      if (event.defaultPrevented || !(event.target instanceof Element)) return;
      if (event instanceof KeyboardEvent && !(event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) return;
      if (event.target.closest("input, textarea, select, a, dialog, [contenteditable=true], [data-subtasks]")) return;
      const row = event.target.closest<HTMLElement>("[data-task-id]");
      const add = row?.querySelector<HTMLButtonElement>("[data-add-subtask]");
      if (!row || !add || add.disabled || !popup) return;
      event.preventDefault();
      parent.current = row;
      const anchor = add.getBoundingClientRect();
      const pointer = event instanceof MouseEvent && (event.clientX !== 0 || event.clientY !== 0);
      const x = pointer ? event.clientX : anchor.left;
      const y = pointer ? event.clientY : anchor.bottom;
      popup.showPopover();
      const bounds = popup.getBoundingClientRect();
      popup.style.left = `${Math.max(4, Math.min(x, document.documentElement.clientWidth - bounds.width - 4))}px`;
      popup.style.top = `${Math.max(4, Math.min(y, window.innerHeight - bounds.height - 4))}px`;
      addButton.current?.focus({ preventScroll: true });
    }

    root.addEventListener("contextmenu", open);
    root.addEventListener("keydown", open);
    return () => {
      root.removeEventListener("contextmenu", open);
      root.removeEventListener("keydown", open);
    };
  }, [board]);

  return <div ref={menu} popover="auto" role="menu" aria-label={t.taskActions} className="task-context-menu"
    onKeyDown={(event) => {
      if (event.key === "Escape" || event.key === "Tab") {
        if (event.key === "Escape") event.preventDefault();
        menu.current?.hidePopover();
        parent.current?.focus();
      }
    }}>
    <button ref={addButton} type="button" role="menuitem" onClick={() => {
      menu.current?.hidePopover();
      parent.current?.querySelector<HTMLButtonElement>("[data-add-subtask]")?.click();
    }}><Icon name="plus" size={16} />{t.addStep}<kbd aria-hidden="true">A</kbd></button>
  </div>;
}
