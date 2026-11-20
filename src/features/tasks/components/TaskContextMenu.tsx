"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Dictionary } from "@/i18n";
import { Icon } from "@/lib/Icon";
import type { Postponement } from "../planning";

interface Props {
  row: RefObject<HTMLLIElement | null>;
  t: Dictionary;
  addSubtask: (() => void) | null;
  postpone: ((when: Postponement) => void) | null;
}

export function TaskContextMenu({ row, t, addSubtask, postpone }: Props) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number; above: number } | null>(null);
  const hasActions = Boolean(addSubtask || postpone);

  function close() {
    menu.current?.hidePopover();
    setAnchor(null);
    opener.current?.focus({ preventScroll: true });
  }

  function open(origin: HTMLElement, point?: { x: number; y: number }) {
    if (typeof menu.current?.showPopover !== "function") return;
    opener.current = origin;
    const bounds = trigger.current?.getBoundingClientRect();
    setAnchor(point ? { ...point, above: point.y } : { x: bounds?.left ?? 0, y: bounds?.bottom ?? 0, above: bounds?.top ?? 0 });
  }

  useLayoutEffect(() => {
    const popup = menu.current;
    if (!anchor || !popup) return;
    popup.showPopover();
    const bounds = popup.getBoundingClientRect();
    popup.style.left = `${Math.max(4, Math.min(anchor.x, document.documentElement.clientWidth - bounds.width - 4))}px`;
    const top = anchor.y + bounds.height <= window.innerHeight - 4 ? anchor.y : anchor.above - bounds.height;
    popup.style.top = `${Math.max(4, top)}px`;
    popup.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }, [anchor]);

  useEffect(() => {
    const item = row.current;
    if (!item || !trigger.current || typeof menu.current?.showPopover !== "function") return;
    const openFromRow = (event: MouseEvent | KeyboardEvent) => {
      if (event.defaultPrevented || !(event.target instanceof Element)) return;
      if (event instanceof KeyboardEvent && !(event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) return;
      if (event.target.closest("input, textarea, select, a, dialog, [contenteditable=true], [data-subtasks], [role=menu]")) return;
      event.preventDefault();
      const point = event instanceof MouseEvent && (event.clientX !== 0 || event.clientY !== 0)
        ? { x: event.clientX, y: event.clientY } : undefined;
      open(event.target.closest<HTMLElement>("button") ?? item, point);
    };
    item.addEventListener("contextmenu", openFromRow);
    item.addEventListener("keydown", openFromRow);
    return () => {
      item.removeEventListener("contextmenu", openFromRow);
      item.removeEventListener("keydown", openFromRow);
    };
  }, [row, hasActions]);

  if (!hasActions) return null;
  return <>
    <button ref={trigger} type="button" className="task-more" aria-label={t.taskActions} title={t.taskActions}
      aria-haspopup="menu" aria-controls={id} aria-expanded={anchor !== null}
      onPointerDown={() => { wasOpen.current = Boolean(menu.current?.matches(":popover-open")); }}
      onPointerCancel={() => { wasOpen.current = false; }}
      onClick={(event) => {
        const toggleClosed = event.detail > 0 && wasOpen.current;
        wasOpen.current = false;
        if (toggleClosed || menu.current?.matches(":popover-open")) close();
        else open(event.currentTarget);
      }}><Icon name="more" size={17} /></button>
    <div ref={menu} id={id} popover="auto" role="menu" aria-label={t.taskActions} className="task-context-menu"
      onToggle={(event) => { if (event.newState === "closed") setAnchor(null); }}
      onKeyDown={(event) => {
        if (event.key === "Escape" || event.key === "Tab") {
          if (event.key === "Escape") event.preventDefault();
          close();
          return;
        }
        const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "ArrowDown" ? (index + 1) % items.length
          : event.key === "ArrowUp" ? (index - 1 + items.length) % items.length
          : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : -1;
        if (next >= 0) { event.preventDefault(); items[next].focus(); }
      }}>
      {anchor && <>
      {addSubtask && <button type="button" role="menuitem" tabIndex={-1} onClick={() => { close(); addSubtask(); }}>
        <Icon name="plus" size={16} />{t.addStep}
      </button>}
      {postpone && <>
        <button type="button" role="menuitem" tabIndex={-1} onClick={() => { close(); postpone("tomorrow"); }}>
          <Icon name="calendar" size={16} />{t.postponeTomorrow}
        </button>
        <button type="button" role="menuitem" tabIndex={-1} onClick={() => { close(); postpone("next-week"); }}>
          <Icon name="calendar" size={16} />{t.postponeNextWeek}
        </button>
      </>}
      </>}
    </div>
  </>;
}
