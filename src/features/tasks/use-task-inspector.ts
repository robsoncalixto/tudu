"use client";

import { useLayoutEffect, useRef, useState } from "react";

export function useTaskInspector() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const returning = useRef<{ trigger: HTMLButtonElement | null } | null>(null);

  // Runs in the commit that removes the panel, so nothing the person does next can be undone by a late focus change.
  useLayoutEffect(() => {
    const leaving = returning.current;
    if (!leaving || selectedId !== null) return;
    returning.current = null;
    if (document.querySelector("dialog:modal")) return;
    const { trigger } = leaving;
    if (trigger?.isConnected && !trigger.closest("details:not([open])") && trigger.getClientRects().length) {
      trigger.focus({ preventScroll: true });
    } else {
      document.querySelector<HTMLElement>("#board-query")?.focus({ preventScroll: true });
    }
  }, [selectedId]);

  function close() {
    returning.current = { trigger: opener.current };
    opener.current = null;
    setSelectedId(null);
  }

  function toggle(id: string, trigger: HTMLButtonElement) {
    if (id === selectedId) { close(); return; }
    returning.current = null;
    opener.current = trigger;
    setSelectedId(id);
  }

  return { selectedId, toggle, close, setSelectedId };
}
