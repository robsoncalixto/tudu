"use client";

import { useLayoutEffect, useState } from "react";
import { restoreBoardReturn, type BoardReturn, type TaskFilter, type TaskSort } from "./board-navigation";

const RETURN_KEY = "tudu.boardReturn";

export function useBoardNavigation(startView: BoardReturn["startView"]) {
  const [filter, setFilter] = useState<TaskFilter>({ kind: startView });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TaskSort>("due");
  const [text, setText] = useState("");

  useLayoutEffect(() => {
    const url = new URL(window.location.href);
    // The history entry also covers the browser Back button when the board is reloaded.
    if (url.searchParams.get("resume") !== "1" && !history.state?.tuduFromBoard) return;
    try {
      const previous = restoreBoardReturn(sessionStorage.getItem(RETURN_KEY), startView);
      sessionStorage.removeItem(RETURN_KEY);
      if (previous) {
        setFilter(previous.filter);
        setSort(previous.sort);
        setQuery(previous.query);
        setText(previous.text);
      }
    } catch { /* Navigation still works when browser storage is unavailable. */ }
    url.searchParams.delete("resume");
    history.replaceState({ ...history.state, tuduFromBoard: false }, "", url);
  }, [startView]);

  function rememberForSettings() {
    try {
      const snapshot: BoardReturn = { startView, filter, sort, query, text };
      sessionStorage.setItem(RETURN_KEY, JSON.stringify(snapshot));
      history.replaceState({ ...history.state, tuduFromBoard: true }, "");
    } catch { /* Settings remains reachable with browser storage disabled. */ }
  }

  return { filter, setFilter, query, setQuery, sort, setSort, text, setText, rememberForSettings };
}
