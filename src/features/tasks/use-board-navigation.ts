"use client";

import { useLayoutEffect, useState } from "react";
import { restoreBoardReturn, restoreTaskSort, type StartView, type TaskFilter, type TaskSort } from "./board-navigation";

const SORT_KEY = "tudu.taskSort";
const RETURN_KEY = "tudu.boardReturn";

export function useBoardNavigation(startView: StartView) {
  const [view, setView] = useState({ startView, filter: { kind: startView } as TaskFilter, query: "", text: "" });
  const [sort, updateSort] = useState<TaskSort>(() => restoreTaskSort(null));
  const [fallbackSort, setFallbackSort] = useState<TaskSort>();
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    try {
      const previous = restoreBoardReturn(sessionStorage.getItem(RETURN_KEY), startView);
      if (previous) {
        setView(previous);
        setFallbackSort(previous.sort);
        if (previous.sort) updateSort(previous.sort);
      }
    } catch { /* Session storage is optional. */ }
    try {
      updateSort(restoreTaskSort(localStorage.getItem(SORT_KEY)));
      setFallbackSort(undefined);
    } catch { /* Keep the session fallback. */ }
    setReady(true);
  }, [startView]);

  useLayoutEffect(() => {
    if (!ready) return;
    if (view.startView !== startView) {
      setView((current) => ({ ...current, startView, filter: { kind: startView }, query: "" }));
      return;
    }
    try { sessionStorage.setItem(RETURN_KEY, JSON.stringify({ ...view, sort: fallbackSort })); }
    catch { /* The mounted workspace retains the draft. */ }
  }, [view, startView, ready, fallbackSort]);

  function setSort(next: TaskSort) {
    updateSort(next);
    try { localStorage.setItem(SORT_KEY, next); setFallbackSort(undefined); }
    catch { setFallbackSort(next); }
  }

  return {
    filter: view.filter,
    query: view.query,
    text: view.text,
    sort,
    setSort,
    setFilter: (filter: TaskFilter) => setView((current) => ({ ...current, filter })),
    setQuery: (query: string) => setView((current) => ({ ...current, query })),
    setText: (text: string) => setView((current) => ({ ...current, text })),
  };
}
