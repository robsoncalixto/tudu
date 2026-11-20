"use client";

import { useLayoutEffect, useState } from "react";
import { restoreBoardReturn, restoreTaskSort, type StartView, type TaskFilter, type TaskSort } from "./board-navigation";

const SORT_KEY = "tudu.taskSort";
const DAY_SORT_KEY = "tudu.todaySort";
const RETURN_KEY = "tudu.boardReturn";

export function useBoardNavigation(startView: StartView) {
  const [view, setView] = useState({ startView, filter: { kind: startView } as TaskFilter, query: "", text: "" });
  const [listSort, updateListSort] = useState<TaskSort>("due");
  const [daySort, updateDaySort] = useState<TaskSort>("manual");
  const sort = view.filter.kind === "today" ? daySort : listSort;
  const [fallbackSort, setFallbackSort] = useState<TaskSort>();
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    try {
      const previous = restoreBoardReturn(sessionStorage.getItem(RETURN_KEY), startView);
      if (previous) {
        setView(previous);
        setFallbackSort(previous.sort);
        if (previous.sort) {
          if (previous.filter.kind === "today") updateDaySort(previous.sort);
          else if (previous.sort !== "manual") updateListSort(previous.sort);
        }
      }
    } catch { /* Session storage is optional. */ }
    try {
      const list = restoreTaskSort(localStorage.getItem(SORT_KEY));
      updateListSort(list === "manual" ? "due" : list);
      updateDaySort(restoreTaskSort(localStorage.getItem(DAY_SORT_KEY), "manual"));
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
    const today = view.filter.kind === "today";
    if (today) updateDaySort(next);
    else if (next !== "manual") updateListSort(next);
    try { localStorage.setItem(today ? DAY_SORT_KEY : SORT_KEY, next); setFallbackSort(undefined); }
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
