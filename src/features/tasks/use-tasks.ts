"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { captureApi } from "@/features/capture/api";
import { quickAddApi } from "@/features/quick-add/api";
import { errorCode } from "@/lib/http";
import { useVisibleRefresh } from "@/lib/use-visible-refresh";
import type { TaskFilter } from "./selectors";
import { tasksApi } from "./api";
import { applyTaskMutations, type PendingTaskMutation } from "./optimistic-tasks";
import type { Task, TaskPatch } from "./schema";

/**
 * Owns the task list. `add` and `capture` reject with an ApiError so the
 * caller can keep the user's text; `patch` and `remove` update optimistically,
 * roll back on failure and report the error code through `onError`.
 */
export function useTasks(onError: (code: string) => void, onNext?: (task: Task) => void, onRefreshed?: (currentIds: ReadonlySet<string>) => void, provider?: string) {
  const [confirmed, setConfirmed] = useState<Task[] | null>(null);
  const [pending, setPending] = useState<PendingTaskMutation[]>([]);
  const revision = useRef(0);
  const loaded = useRef(false);
  const lastWrite = useRef(new Map<string, Promise<boolean>>());
  const tasks = useMemo(() => confirmed && applyTaskMutations(confirmed, pending), [confirmed, pending]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [aiEnabled, setAiEnabled] = useState(false);
  const report = useRef(onError);
  report.current = onError;
  const scheduled = useRef(onNext);
  scheduled.current = onNext;
  const refreshed = useRef(onRefreshed);
  refreshed.current = onRefreshed;

  const load = useCallback(async (isCurrent: () => boolean) => {
    const readRevision = revision.current;
    try {
      const saved = await tasksApi.list();
      // A response started before a confirmed local write may be stale.
      if (!isCurrent() || readRevision !== revision.current) return;
      setConfirmed(saved);
      setLoadFailed(false);
      if (loaded.current) refreshed.current?.(new Set([...saved.map((task) => task.id), ...lastWrite.current.keys()]));
      loaded.current = true;
    } catch {
      if (isCurrent() && !loaded.current) setLoadFailed(true);
    }
  }, []);
  useVisibleRefresh(load, loadAttempt);

  const retryLoad = useCallback(() => {
    setLoadFailed(false);
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    let active = true;
    captureApi.status()
      .then((enabled) => { if (active) setAiEnabled(enabled); })
      .catch(() => { if (active) setAiEnabled(false); });
    return () => { active = false; };
  }, [provider]);

  const append = useCallback((created: Task[]) => {
    revision.current++;
    setConfirmed((current) => {
      const existing = new Set(current?.map((task) => task.id));
      return [...(current ?? []), ...created.filter((task) => !existing.has(task.id))];
    });
    return created;
  }, []);

  const add = useCallback((text: string, today: string, filter: TaskFilter) => {
    const context = filter.kind === "today" ? { plannedFor: today }
      : filter.kind === "project" ? { projectId: filter.id }
      : filter.kind === "tag" ? { tag: filter.tag } : {};
    return quickAddApi.create(text, today, context).then(append);
  }, [append]);

  const capture = useCallback(
    (text: string, today: string) => captureApi.capture(text, today).then(append),
    [append],
  );

  const mutate = useCallback((id: string, changes: TaskPatch | null) => {
    const mutation = { id, patch: changes };
    setPending((current) => [...current, mutation]);

    // Order writes to the same task while other tasks remain independent.
    const previous = lastWrite.current.get(id) ?? Promise.resolve();
    const request: Promise<boolean> = previous.then(async () => {
      try {
        if (changes === null) {
          await tasksApi.remove(id);
          revision.current++;
          setConfirmed((current) => current?.filter((task) => task.id !== id) ?? null);
        } else {
          const { task, nextTask } = await tasksApi.update(id, changes);
          revision.current++;
          setConfirmed((current) => {
            if (!current) return null;
            const next = current.map((item) => item.id === id ? task : item);
            // Retried completions can return an occurrence already on the board.
            if (nextTask && !next.some((item) => item.id === nextTask.id)) next.push(nextTask);
            return next;
          });
          if (changes.done && nextTask && !nextTask.done) scheduled.current?.(nextTask);
        }
        return true;
      } catch (error) {
        report.current(errorCode(error));
        return false;
      } finally {
        setPending((current) => current.filter((item) => item !== mutation));
        if (lastWrite.current.get(id) === request) lastWrite.current.delete(id);
      }
    });
    lastWrite.current.set(id, request);
    return request;
  }, []);

  const patch = useCallback((id: string, changes: TaskPatch) => mutate(id, changes), [mutate]);
  const remove = useCallback((id: string) => mutate(id, null), [mutate]);

  const clearProject = useCallback((id: string) => {
    revision.current++;
    setConfirmed((current) => current?.map((task) => task.projectId === id ? { ...task, projectId: null } : task) ?? null);
  }, []);
  return { tasks, aiEnabled, loadFailed, retryLoad, add, capture, patch, remove, clearProject };
}
