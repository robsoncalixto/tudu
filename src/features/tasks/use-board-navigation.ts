"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { restoreBoardReturn, restoreTaskSort, type BoardReturn, type ComposerDraft, type StartView, type TaskFilter, type TaskSort } from "./board-navigation";

const SORT_KEY = "tudu.taskSort";
const DAY_SORT_KEY = "tudu.todaySort";
const RETURN_KEY = "tudu.boardReturn";

export type SetComposerDraft = (update: ComposerDraft | ((current: ComposerDraft) => ComposerDraft), expected?: ComposerDraft) => boolean;

export function useBoardNavigation(startView: StartView) {
  const [view, setView] = useState<Omit<BoardReturn, keyof ComposerDraft>>({ startView, filter: { kind: startView }, query: "" });
  const [draft, updateDraft] = useState<ComposerDraft>({ text: "" });
  const currentDraft = useRef(draft);
  const [listSort, updateListSort] = useState<TaskSort>("due");
  const [daySort, updateDaySort] = useState<TaskSort>("manual");
  const sort = view.filter.kind === "today" ? view.daySort ?? daySort : view.listSort ?? listSort;
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (ready) return;
    try {
      const previous = restoreBoardReturn(sessionStorage.getItem(RETURN_KEY), startView);
      if (previous) {
        const { text, choice, ...navigation } = previous;
        setView(navigation);
        setDraft({ text, choice });
      }
    } catch { /* Session storage is optional. */ }
    try {
      updateListSort(restoreTaskSort(localStorage.getItem(SORT_KEY)));
      updateDaySort(restoreTaskSort(localStorage.getItem(DAY_SORT_KEY), "manual"));
    } catch { /* Keep the session fallback. */ }
    setReady(true);
  }, [ready, startView]);

  useLayoutEffect(() => {
    if (!ready) return;
    if (view.startView !== startView) {
      setView((current) => ({ ...current, startView, filter: { kind: startView }, query: "" }));
      return;
    }
    try { sessionStorage.setItem(RETURN_KEY, JSON.stringify({ ...view, ...draft })); }
    catch { /* The mounted workspace retains the draft. */ }
  }, [view, draft, startView, ready]);

  const setDraft: SetComposerDraft = (update, expected) => {
    // Requests can finish after navigation or after another submission has cleared the composer.
    if (expected && currentDraft.current !== expected) return false;
    const next = typeof update === "function" ? update(currentDraft.current) : update;
    currentDraft.current = next;
    updateDraft(next);
    return true;
  };

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
    draft,
    sort,
    setSort,
    setFilter: (filter: TaskFilter) => setView((current) => ({ ...current, filter })),
    setQuery: (query: string) => setView((current) => ({ ...current, query })),
    setDraft,
  };
}
