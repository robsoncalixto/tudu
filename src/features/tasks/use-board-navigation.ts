"use client";

import { useLayoutEffect, useState } from "react";
import { restoreBoardReturn, restoreTaskSort, type BoardReturn, type StartView, type TaskFilter, type TaskSort } from "./board-navigation";

const SORT_KEY = "tudu.taskSort";
const DAY_SORT_KEY = "tudu.todaySort";
const RETURN_KEY = "tudu.boardReturn";

export function useBoardNavigation(startView: StartView) {
  const [view, setView] = useState<BoardReturn>({ startView, filter: { kind: startView }, query: "", text: "" });
  const [listSort, updateListSort] = useState<TaskSort>("due");
  const [daySort, updateDaySort] = useState<TaskSort>("manual");
  const sort = view.filter.kind === "today" ? view.daySort ?? daySort : view.listSort ?? listSort;
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    try {
      const previous = restoreBoardReturn(sessionStorage.getItem(RETURN_KEY), startView);
      if (previous) setView(previous);
    } catch { /* Session storage is optional. */ }
    try {
      updateListSort(restoreTaskSort(localStorage.getItem(SORT_KEY)));
      updateDaySort(restoreTaskSort(localStorage.getItem(DAY_SORT_KEY), "manual"));
    } catch { /* Keep the session fallback. */ }
    setReady(true);
  }, [startView]);

  useLayoutEffect(() => {
    if (!ready) return;
    if (view.startView !== startView) {
      setView((current) => ({ ...current, startView, filter: { kind: startView }, query: "" }));
      return;
    }
    try { sessionStorage.setItem(RETURN_KEY, JSON.stringify(view)); }
    catch { /* The mounted workspace retains the draft. */ }
  }, [view, startView, ready]);

  function setSort(next: TaskSort) {
    const today = view.filter.kind === "today";
    if (!today && next === "manual") return;
    if (today) updateDaySort(next);
    else updateListSort(next);
    let fallback: TaskSort | undefined;
    try { localStorage.setItem(today ? DAY_SORT_KEY : SORT_KEY, next); }
    catch { fallback = next; }
    const field = today ? "daySort" : "listSort";
    setView((current) => ({ ...current, [field]: fallback }));
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
