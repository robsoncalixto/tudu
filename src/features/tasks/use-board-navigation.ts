"use client";

import { useLayoutEffect, useState } from "react";
import { restoreTaskSort, type StartView, type TaskFilter, type TaskSort } from "./board-navigation";

const SORT_KEY = "tudu.taskSort";

export function useBoardNavigation(startView: StartView) {
  const [filter, setFilter] = useState<TaskFilter>({ kind: startView });
  const [query, setQuery] = useState("");
  const [sort, updateSort] = useState<TaskSort>(() => restoreTaskSort(null));
  const [text, setText] = useState("");

  useLayoutEffect(() => {
    try { updateSort(restoreTaskSort(localStorage.getItem(SORT_KEY))); } catch { /* Device storage is optional. */ }
  }, []);

  useLayoutEffect(() => {
    setFilter({ kind: startView });
    setQuery("");
  }, [startView]);

  function setSort(next: TaskSort) {
    updateSort(next);
    try { localStorage.setItem(SORT_KEY, next); } catch { /* The workspace retains the sort during navigation. */ }
  }

  return { filter, setFilter, query, setQuery, sort, setSort, text, setText };
}
