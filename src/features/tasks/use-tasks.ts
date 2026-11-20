"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { captureApi } from "@/features/capture/api";
import { quickAddApi } from "@/features/quick-add/api";
import { errorCode } from "@/lib/http";
import type { Project } from "@/features/projects/schema";
import type { CaptureDefaults } from "@/features/capture/schema";
import type { QuickAddDefaults } from "@/features/quick-add/schema";
import { tasksApi } from "./api";
import { applyTaskMutations, type PendingTaskMutation } from "./optimistic-tasks";
import type { Task, TaskPatch } from "./schema";

/**
 * Owns the task list. `add` and `capture` reject with an ApiError so the
 * caller can keep the user's text; `patch` and `remove` update optimistically,
 * roll back on failure and report the error code through `onError`.
 */
export function useTasks(onError: (code: string) => void, onNext?: (task: Task) => void) {
  const [confirmed, setConfirmed] = useState<Task[] | null>(null);
  const [pending, setPending] = useState<PendingTaskMutation[]>([]);
  const lastWrite = useRef(new Map<string, Promise<boolean>>());
  const tasks = useMemo(() => confirmed && applyTaskMutations(confirmed, pending), [confirmed, pending]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [aiEnabled, setAiEnabled] = useState(false);
  const report = useRef(onError);
  report.current = onError;
  const scheduled = useRef(onNext);
  scheduled.current = onNext;

  useEffect(() => {
    let active = true;
    tasksApi.list()
      .then((saved) => { if (active) setConfirmed(saved); })
      .catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, [loadAttempt]);

  const retryLoad = useCallback(() => {
    setLoadFailed(false);
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    captureApi
      .status()
      .then(setAiEnabled)
      .catch(() => setAiEnabled(false));
  }, []);

  const append = useCallback((created: Task[]) => {
    setConfirmed((current) => [...(current ?? []), ...created]);
    return created;
  }, []);

  const add = useCallback((text: string, today: string, defaults: QuickAddDefaults, projects: Project[]) =>
    quickAddApi.create(text, today, defaults, projects).then(append), [append]);

  const capture = useCallback(
    (text: string, today: string, defaults: CaptureDefaults) => captureApi.capture(text, today, defaults).then(append),
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
          setConfirmed((current) => current?.filter((task) => task.id !== id) ?? null);
        } else {
          const { task, nextTask } = await tasksApi.update(id, changes);
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
    setConfirmed((current) => current?.map((task) => task.projectId === id ? { ...task, projectId: null } : task) ?? null);
  }, []);
  return { tasks, aiEnabled, loadFailed, retryLoad, add, capture, patch, remove, clearProject };
}
