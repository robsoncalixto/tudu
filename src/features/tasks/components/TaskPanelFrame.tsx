"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

export function TaskPanelFrame({ taskId, label, onClose, children }: {
  taskId: string; label: string; onClose: () => void; children: ReactNode;
}) {
  const frame = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = frame.current;
    if (!dialog) return;
    const narrow = window.matchMedia("(max-width: 959px)");
    function display() {
      if (!dialog) return;
      if (dialog.open) dialog.close();
      if (narrow.matches) dialog.showModal();
      else dialog.show();
    }
    display();
    narrow.addEventListener("change", display);
    return () => { narrow.removeEventListener("change", display); dialog.close(); };
  }, []);

  useLayoutEffect(() => {
    const dialog = frame.current;
    if (!dialog) return;
    dialog.scrollTop = 0;
    dialog.querySelector<HTMLElement>("#task-inspector")?.scrollTo(0, 0);
    dialog.querySelector<HTMLElement>("[data-close-panel]")?.focus({ preventScroll: true });
  }, [taskId]);

  return <dialog ref={frame} className="inspector-host" aria-label={label}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onKeyDown={(event) => {
      if (event.defaultPrevented || event.nativeEvent.isComposing) return;
      // The native picker consumes Escape itself while an option list is open.
      if (event.key === "Escape" && CSS.supports("selector(select:open)") &&
        event.target instanceof Element && event.target.closest("select:open")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    }}
    onClick={(event) => {
      if (event.target !== event.currentTarget || !event.currentTarget.matches(":modal")) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right) onClose();
    }}>
    {children}
  </dialog>;
}
