"use client";

import { useEffect, useRef } from "react";

const FIELDS = "input, textarea, select, [contenteditable='true']";

/**
 * While the field the person asked for is not on screen yet, keeps what they type for it.
 * Without this those keys would run as shortcuts or be lost. `onReady` receives the text once the wait is over.
 */
export function useTypeAhead(waiting: boolean, onReady: (typed: string) => void) {
  const typed = useRef("");
  const deliver = useRef(onReady);
  deliver.current = onReady;

  useEffect(() => {
    if (!waiting) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      // A field already in use keeps its own keys.
      if (event.target instanceof HTMLElement && event.target.closest(FIELDS)) return;
      if (event.key.length === 1) typed.current += event.key;
      else if (event.key === "Backspace") typed.current = typed.current.slice(0, -1);
      else return;
      event.preventDefault();
      event.stopPropagation();
    }
    // Heard on the way down, before the page shortcuts that listen on the way up.
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const text = typed.current;
      typed.current = "";
      deliver.current(text);
    };
  }, [waiting]);
}
