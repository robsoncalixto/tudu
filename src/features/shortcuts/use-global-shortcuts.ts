"use client";

import { useEffect } from "react";
import { shortcutsApi } from "./api";
import { chordOf, matchShortcut } from "./selectors";

const SEQUENCE_MS = 1500;
const TYPING = "input:not([type='checkbox'], [type='radio']), textarea, select, [contenteditable='true'], "
  + "[role='textbox'], [role='combobox'], [role='searchbox'], [role='listbox'], [role='menu'], [role='separator']";

/** A dialog, an open menu or the phone navigation owns the keyboard until it closes. */
function isCovered(): boolean {
  try { return document.querySelector("dialog:modal, [popover]:popover-open, .sidebar.is-expanded") !== null; }
  catch { return document.querySelector("dialog[open]:not(.inspector-host), .sidebar.is-expanded") !== null; }
}

/** Listens for the shortcuts that work across the page and never while the person is typing. */
export function useGlobalShortcuts() {
  useEffect(() => {
    let prefix: string | null = null;
    let timer: number | undefined;
    function forget() {
      prefix = null;
      window.clearTimeout(timer);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      // A date field holds no text of its own to undo, so a chord with Ctrl or ⌘ still reaches the page from there.
      const chordFromDate = target instanceof HTMLInputElement && target.type === "date" && (event.ctrlKey || event.metaKey);
      if (((target?.isContentEditable || target?.closest(TYPING)) && !chordFromDate) || isCovered()) { forget(); return; }
      const row = target?.closest<HTMLElement>("[data-task-id]") ?? null;
      const match = matchShortcut(chordOf(event), prefix, {
        characters: shortcutsApi.charactersEnabled(), within: row === null ? null : row === target ? "row" : "list", repeat: event.repeat,
      });
      forget();
      if (match?.kind === "wait") {
        prefix = match.prefix;
        timer = window.setTimeout(forget, SEQUENCE_MS);
      } else if (match && shortcutsApi.run(match.id, target)) event.preventDefault();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      forget();
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
