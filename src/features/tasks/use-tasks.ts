"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { captureApi } from "@/features/capture/api";
import { quickAddApi } from "@/features/quick-add/api";
import { ApiError, errorCode } from "@/lib/http";
import type { Project } from "@/features/projects/schema";
import type { CaptureDefaults } from "@/features/capture/schema";
import type { QuickAddDefaults } from "@/features/quick-add/schema";
import { useVisibleRefresh } from "@/lib/use-visible-refresh";
import { tasksApi } from "./api";
import { applyTaskMutations, provisionalTask, type PendingTaskMutation } from "./optimistic-tasks";
import type { Priority, Task, TaskPatch } from "./schema";

/**
 * Owns the task list. `add` shows the new tasks at once and `capture` waits for
 * the server; both reject with an ApiError so the caller can keep the user's
 * text. `patch` and `remove` update optimistically, roll back on failure and
 * report the error code through `onError`.
 */
export function useTasks(onError: (code: string) => void, onNext?: (task: Task) => void, onRefreshed?: (currentIds: ReadonlySet<string>) => void, provider?: string) {
  const [confirmed, setConfirmed] = useState<Task[] | null>(null);
  const [pending, setPending] = useState<PendingTaskMutation[]>([]);
  const [unsaved, setUnsaved] = useState<Task[]>([]);
  const revision = useRef(0);
  const loaded = useRef(false);
  const lastWrite = useRef(new Map<string, Promise<boolean>>());
  const tasks = useMemo(() => confirmed && [...applyTaskMutations(confirmed, pending), ...unsaved], [confirmed, pending, unsaved]);
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
      if (!isCurrent()) return;
      if (readRevision !== revision.current) return true;
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
    // Keep confirmed tasks visible while the next read is in flight.
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

  const add = useCallback((text: string, today: string, defaults: QuickAddDefaults, projects: Project[], priority: Priority) => {
    const drafts = quickAddApi.previewDrafts(text, today, defaults, projects);
    if (!drafts) throw new ApiError("invalid_quick_task", 400);
    const now = new Date();
    const shown = drafts.map((draft) => provisionalTask(draft, priority, now));
    const settle = () => setUnsaved((current) => current.filter((task) => !shown.includes(task)));
    setUnsaved((current) => [...current, ...shown]);
    // The saved tasks take the place of the shown ones in a single render.
    const saved = tasksApi.create(drafts.length === 1 ? drafts[0] : drafts)
      .then((created) => { settle(); return append(created); }, (error: unknown) => { settle(); throw error; });
    return { shown, saved };
  }, [append]);

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
  const reorder = useCallback(async (day: string, taskIds: string[], expected: string[]) => {
    const order = await tasksApi.setDayOrder({ day, taskIds, expected }).catch((error: unknown) => {
      if (errorCode(error) === "task_changed") retryLoad();
      throw error;
    });
    revision.current++;
    const rank = new Map(order.taskIds.map((id, index) => [id, index]));
    setConfirmed((before) => before?.map((task) => {
      const position = rank.get(task.id);
      return position === undefined ? task : { ...task, dayRanks: { ...task.dayRanks, [day]: position } };
    }) ?? null);
  }, [retryLoad]);
  return { reorder, tasks, aiEnabled, loadFailed, retryLoad, add, capture, patch, remove, clearProject };
}
