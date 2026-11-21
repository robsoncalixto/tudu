"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Notice = {
  kind: "ok" | "error";
  text: string;
  /** Takes back what the notice reports. The undo key runs it for as long as the notice shows. */
  undo?: () => void;
  /** Something else to do about the message, such as going to the task it names. */
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
    // On a phone so does hiding it: a hidden page there may never get another turn to send what it held.
    // With a mouse the page hears when it is closed, so a glance at another tab keeps the chance to undo.
    const hide = () => {
      if (document.visibilityState === "hidden" && shown.current?.onGone && window.matchMedia("(pointer: coarse)").matches) setNotice(null);
    };
    window.addEventListener("pagehide", settle);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("pagehide", settle);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [setNotice]);
  return [notice, setNotice] as const;
}
