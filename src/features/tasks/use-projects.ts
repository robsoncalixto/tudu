"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { projectsApi } from "@/features/projects/api";
import type { Project } from "@/features/projects/schema";
import { errorCode } from "@/lib/http";

export function useProjects(onError: (code: string) => void, onDeleted: (id: string) => void) {
  const [projects, setProjects] = useState<Project[]>([]);
  const report = useRef(onError);
  report.current = onError;
  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => report.current("generic"));
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
      onDeleted(id);
      return true;
    } catch (error) { report.current(errorCode(error)); return false; }
  }, [onDeleted]);
  return { projects, createProject, renameProject, deleteProject };
}
