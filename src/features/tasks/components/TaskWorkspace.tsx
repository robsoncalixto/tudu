"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Settings } from "@/features/settings/schema";
import { errorMessage } from "@/i18n";
import { useLocale } from "@/i18n/use-locale";
import { dueLabel } from "@/lib/dates";
import { useToday } from "@/lib/use-today";
import type { Task } from "../schema";
import { buildTaskView, type TaskFilter } from "../selectors";
import { useBoardNavigation } from "../use-board-navigation";
import { useProjects } from "../use-projects";
import { useTaskInspector } from "../use-task-inspector";
import { useTasks } from "../use-tasks";
import { Sidebar } from "./Sidebar";
import "./board.css";

type Notice = { kind: "ok" | "error"; text: string } | null;

function useWorkspaceState(settings: Settings) {
  const page = usePathname();
  const router = useRouter();
  const { locale, t } = useLocale(settings.locale);
  const today = useToday();
  const [notice, setNotice] = useState<Notice>(null);
  const navigation = useBoardNavigation(settings.startView);
  const { filter, query, sort, setFilter, setQuery } = navigation;
  const inspector = useTaskInspector();
  const { selectedId, setSelectedId } = inspector;
  const fail = useCallback((code: string) => setNotice({ kind: "error", text: errorMessage(t, code) }), [t]);
  const scheduled = useCallback((task: Task) => {
    if (task.due && today) setNotice({ kind: "ok", text: t.nextOccurrence(dueLabel(task.due, today, locale, t, settings.dateFormat)) });
  }, [today, locale, t, settings.dateFormat]);
  const taskData = useTasks(fail, scheduled, (currentIds) => {
    if (selectedId && !currentIds.has(selectedId)) {
      inspector.close();
      setNotice({ kind: "ok", text: t.taskDeletedElsewhere });
    }
  }, settings.aiProvider);
  const projectData = useProjects(fail, taskData.clearProject, (ids) => {
    if (filter.kind !== "project" || ids.has(filter.id)) return;
    setSelectedId(null);
    setQuery("");
    setFilter({ kind: "all" });
    setNotice(null);
  });
  const { tasks } = taskData;
  const { projects } = projectData;
  const view = useMemo(() => buildTaskView(tasks ?? [], filter, today ?? "", projects, query, sort),
    [tasks, filter, today, projects, query, sort]);
  const selectedTask = tasks?.find((task) => task.id === selectedId);

  useEffect(() => {
    if (page !== "/") setSelectedId(null);
  }, [page, setSelectedId]);

  function select(next: TaskFilter) {
    setSelectedId(null);
    setQuery(""); setFilter(next); setNotice(null);
    if (page !== "/") router.push("/");
  }

  return { page, settings, locale, t, today, navigation, taskData, projectData, selectedTask, inspector,
    view, notice, setNotice, fail, select };
}

const WorkspaceContext = createContext<ReturnType<typeof useWorkspaceState> | null>(null);

export function useTaskWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("The task board requires its workspace");
  return workspace;
}

export function TaskWorkspace({ settings, children }: { settings: Settings; children: ReactNode }) {
  const workspace = useWorkspaceState(settings);
  const { page, navigation, projectData, t, view, select, selectedTask } = workspace;
  return <WorkspaceContext.Provider value={workspace}>
    <div className={`shell${page === "/" && selectedTask ? " has-inspector" : ""}`}>
      <Sidebar t={t} view={view} filter={navigation.filter} page={page} onFilter={select}
        projectManager={{ projects: projectData.projects, error: projectData.projectError ? errorMessage(t, projectData.projectError) : "",
          clearError: projectData.clearProjectError, onCreate: projectData.createProject, onRename: projectData.renameProject,
          onDelete: async (id) => {
            if (!await projectData.deleteProject(id)) return false;
            if (navigation.filter.kind === "project" && navigation.filter.id === id) {
              if (page === "/") select({ kind: "all" });
              else navigation.setFilter({ kind: "all" });
            }
            return true;
          },
        }} />
      {children}
    </div>
  </WorkspaceContext.Provider>;
}
