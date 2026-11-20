"use client";

import type { RefObject } from "react";
import { shortcutsApi } from "@/features/shortcuts/api";
import type { Dictionary } from "@/i18n";
import { Icon } from "@/lib/Icon";

interface Props {
  t: Dictionary;
  query: string;
  onQuery: (query: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  /** Rows the person can see, in order. */
  rows: () => HTMLElement[];
  /** Escape with nothing to clear hands the keyboard back to the list. */
  onLeave: () => void;
}

/** Filters the list on screen. Escape clears what was typed, then leaves the field. */
export function BoardSearch({ t, query, onQuery, inputRef, rows, onLeave }: Props) {
  function clear() { onQuery(""); inputRef.current?.focus(); }
  return <div className="board-search" role="search">
    <label htmlFor="board-query"><Icon name="search" size={17} /></label>
    <input ref={inputRef} type="search" id="board-query" value={query} aria-label={t.taskSearch} placeholder={t.taskSearch}
      onChange={(event) => onQuery(event.target.value)}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        const keys = shortcutsApi.match("search", event);
        // One key, two steps: what was typed goes first, then the keyboard goes back to the list.
        if (query && keys.includes("clearSearch")) { event.preventDefault(); clear(); }
        else if (!query && keys.includes("leaveSearch")) { event.preventDefault(); onLeave(); }
        else if (keys.includes("searchResults") && rows().length) { event.preventDefault(); rows()[0].focus(); }
      }} />
    {query && <button type="button" className="icon-btn" aria-label={t.clearSearch} onClick={clear}><Icon name="x" size={14} /></button>}
  </div>;
}
