"use client";

import { useCallback, useRef, useState } from "react";
import { projectsApi } from "@/features/projects/api";
import type { Project } from "@/features/projects/schema";
import { errorCode } from "@/lib/http";
import { useVisibleRefresh } from "@/lib/use-visible-refresh";

export function useProjects(onDeleted: (id: string) => void, onRefreshed?: (ids: ReadonlySet<string>) => void) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectError, setProjectError] = useState<string | null>(null);
  const clearProjectError = () => setProjectError(null);
  const revision = useRef(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const loaded = useRef(false);
  const refreshed = useRef(onRefreshed);
  refreshed.current = onRefreshed;
  const load = useCallback(async (isCurrent: () => boolean) => {
    const readRevision = revision.current;
    try {
      const saved = await projectsApi.list();
      if (!isCurrent()) return;
      if (readRevision !== revision.current) return true;
      loaded.current = true;
      setLoadFailed(false);
      setProjects(saved);
      refreshed.current?.(new Set(saved.map((project) => project.id)));
    } catch {
      if (isCurrent() && !loaded.current) setLoadFailed(true);
    }
  }, []);
  useVisibleRefresh(load, attempt);
  const retryLoad = useCallback(() => setAttempt((current) => current + 1), []);
  const createProject = useCallback(async (name: string) => {
    try {
      const project = await projectsApi.create(name);
      revision.current++;
      setProjects((current) => current.some((item) => item.id === project.id) ? current : [...current, project]);
      return true;
    } catch (error) { setProjectError(errorCode(error)); return false; }
  }, []);
  const renameProject = useCallback(async (id: string, name: string) => {
    try {
      const project = await projectsApi.rename(id, name);
      revision.current++;
      setProjects((current) => current.map((item) => item.id === id ? project : item));
      return true;
    } catch (error) { setProjectError(errorCode(error)); return false; }
  }, []);
  const deleteProject = useCallback(async (id: string) => {
    try {
      await projectsApi.remove(id);
      revision.current++;
      setProjects((current) => current.filter((project) => project.id !== id));
      onDeleted(id);
      return true;
    } catch (error) { setProjectError(errorCode(error)); return false; }
  }, [onDeleted]);
  return { projects, loadFailed, retryLoad, projectError, clearProjectError, createProject, renameProject, deleteProject };
}
