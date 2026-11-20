"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Notice = {
  kind: "ok" | "error";
  text: string;
  action?: { label: string; run: () => void };
  /** Runs once the notice is replaced or dismissed, for work that waited on a possible undo. */
  onGone?: () => void;
} | null;

/** The board's single message. Replacing or dismissing a notice settles whatever was waiting on it. */
export function useNotice() {
  const [notice, show] = useState<Notice>(null);
  const shown = useRef<Notice>(null);
  const setNotice = useCallback((next: Notice | ((current: Notice) => Notice)) => {
    const previous = shown.current;
    const value = typeof next === "function" ? next(previous) : next;
    shown.current = value;
    show(value);
    if (previous && previous !== value) previous.onGone?.();
  }, []);
  useEffect(() => {
    // Closing the tab ends the undo window too.
    const settle = () => shown.current?.onGone?.();
    window.addEventListener("pagehide", settle);
    return () => window.removeEventListener("pagehide", settle);
  }, []);
  return [notice, setNotice] as const;
}
