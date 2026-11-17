"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { captureApi } from "@/features/capture/api";
import { projectsApi } from "@/features/projects/api";
import type { Project } from "@/features/projects/schema";
import { errorCode } from "@/lib/http";
import { tasksApi } from "./api";
import type { Task, TaskPatch } from "./schema";

/**
 * Owns the task list. `add` and `capture` reject with an ApiError so the
 * caller can keep the user's text; `patch` and `remove` update optimistically,
 * roll back on failure and report the error code through `onError`.
 */
export function useTasks(onError: (code: string) => void) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const report = useRef(onError);
  report.current = onError;

  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => report.current("generic"));
    tasksApi
      .list()
      .then(setTasks)
      .catch(() => setTasks([]));
    captureApi
      .status()
      .then(setAiEnabled)
      .catch(() => setAiEnabled(false));
  }, []);

  const append = useCallback((created: Task[]) => {
    setTasks((current) => [...(current ?? []), ...created]);
    return created;
  }, []);

  const add = useCallback((title: string) => tasksApi.create(title).then(append), [append]);

  const capture = useCallback(
    (text: string, today: string) => captureApi.capture(text, today).then(append),
    [append],
  );

  const patch = useCallback((id: string, changes: TaskPatch) => {
    let before: Task | undefined;
    setTasks((current) => {
      before = current?.find((task) => task.id === id);
      return current?.map((task) => (task.id === id ? { ...task, ...changes } : task)) ?? null;
    });
    return tasksApi
      .update(id, changes)
      .then((saved) => {
        setTasks((current) => current?.map((task) => (task.id === id ? saved : task)) ?? null);
        return true;
      })
      .catch((error) => {
        const previous = before;
        if (previous) {
          setTasks((current) => current?.map((task) => (task.id === id ? previous : task)) ?? null);
        }
        report.current(errorCode(error));
        return false;
      });
  }, []);

  const remove = useCallback((id: string) => {
    let snapshot: Task[] | null = null;
    setTasks((current) => {
      snapshot = current;
      return current?.filter((task) => task.id !== id) ?? null;
    });
    tasksApi.remove(id).catch((error) => {
      setTasks(snapshot);
      report.current(errorCode(error));
    });
  }, []);

  const createProject = useCallback(async (name: string) => {
    try {
      const project = await projectsApi.create(name);
      setProjects((current) => [...current, project]);
      return true;
    } catch (error) { report.current(errorCode(error)); return false; }
  }, []);
  const renameProject = useCallback(async (id: string, name: string) => {
    try {
      const project = await projectsApi.rename(id, name);
      setProjects((current) => current.map((item) => item.id === id ? project : item));
      return true;
    } catch (error) { report.current(errorCode(error)); return false; }
  }, []);
  const deleteProject = useCallback(async (id: string) => {
    try {
      await projectsApi.remove(id);
      setProjects((current) => current.filter((project) => project.id !== id));
      setTasks((current) => current?.map((task) => task.projectId === id ? { ...task, projectId: null } : task) ?? null);
      return true;
    } catch (error) { report.current(errorCode(error)); return false; }
  }, []);
  return { tasks, projects, aiEnabled, add, capture, patch, remove, createProject, renameProject, deleteProject };
}
