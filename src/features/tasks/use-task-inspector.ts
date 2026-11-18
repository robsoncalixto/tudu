"use client";

import { useRef, useState } from "react";

export function useTaskInspector() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  function close() {
    const trigger = opener.current;
    setSelectedId(null);
    opener.current = null;
    requestAnimationFrame(() => {
      if (opener.current || document.querySelector("dialog:modal")) return;
      if (trigger?.isConnected && !trigger.closest("details:not([open])") && trigger.getClientRects().length) {
        trigger.focus({ preventScroll: true });
      } else {
        document.querySelector<HTMLElement>("#board-query")?.focus({ preventScroll: true });
      }
    });
  }

  function toggle(id: string, trigger: HTMLButtonElement) {
    if (id === selectedId) { close(); return; }
    opener.current = trigger;
    setSelectedId(id);
  }

  return { selectedId, toggle, close, setSelectedId };
}
