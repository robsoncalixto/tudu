"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { restoreBoardReturn, restoreTaskSort, type BoardReturn, type TaskFilter, type TaskSort } from "./board-navigation";

const RETURN_KEY = "tudu.boardReturn";
const SORT_KEY = "tudu.taskSort";

export function useBoardNavigation(startView: BoardReturn["startView"]) {
  const [filter, setFilter] = useState<TaskFilter>({ kind: startView });
  const [query, setQuery] = useState("");
  const [sort, updateSort] = useState<TaskSort>(() => restoreTaskSort(null));
  const [text, setText] = useState("");
  const unsavedSort = useRef<TaskSort | undefined>(undefined);

  useLayoutEffect(() => {
    try { updateSort(restoreTaskSort(localStorage.getItem(SORT_KEY))); } catch { /* Device storage is optional. */ }
  }, []);

  useLayoutEffect(() => {
    const url = new URL(window.location.href);
    // The history entry also covers the browser Back button when the board is reloaded.
    if (url.searchParams.get("resume") !== "1" && !history.state?.tuduFromBoard) return;
    try {
      const previous = restoreBoardReturn(sessionStorage.getItem(RETURN_KEY), startView);
      sessionStorage.removeItem(RETURN_KEY);
      if (previous) {
        setFilter(previous.filter);
        if (previous.sort) {
          unsavedSort.current = previous.sort;
          updateSort(previous.sort);
        }
        setQuery(previous.query);
        setText(previous.text);
      }
    } catch { /* Navigation still works when browser storage is unavailable. */ }
    url.searchParams.delete("resume");
    history.replaceState({ ...history.state, tuduFromBoard: false }, "", url);
  }, [startView]);

  function rememberForSettings() {
    try {
      const snapshot: BoardReturn = { startView, filter, query, sort: unsavedSort.current, text };
      sessionStorage.setItem(RETURN_KEY, JSON.stringify(snapshot));
      history.replaceState({ ...history.state, tuduFromBoard: true }, "");
    } catch { /* Settings remains reachable with browser storage disabled. */ }
  }

  function setSort(next: TaskSort) {
    updateSort(next);
    try {
      localStorage.setItem(SORT_KEY, next);
      unsavedSort.current = undefined;
    } catch { unsavedSort.current = next; }
  }

  return { filter, setFilter, query, setQuery, sort, setSort, text, setText, rememberForSettings };
}
