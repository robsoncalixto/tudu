"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { subscribeAgentUpdates } from "@/features/agent/api";
import type { QuickTask } from "@/features/quick-add/schema";
import type { Settings } from "@/features/settings/schema";
import { errorMessage } from "@/i18n";
import { useLocale } from "@/i18n/use-locale";
import { dueLabel } from "@/lib/dates";
import { useToday } from "@/lib/use-today";
import type { Task } from "../schema";
import { buildTaskView, type TaskFilter } from "../selectors";
import { useBoardNavigation } from "../use-board-navigation";
import { useNavigationShortcuts } from "../use-navigation-shortcuts";
import { useNotice } from "../use-notice";
import { useProjects } from "../use-projects";
import { useTaskInspector } from "../use-task-inspector";
import { useTaskSuggestions } from "../use-task-suggestions";
import { useTasks } from "../use-tasks";
import { Sidebar } from "./Sidebar";
import "./board.css";

function useWorkspaceState(settings: Settings) {
  const page = usePathname();
  const router = useRouter();
  const { locale, t } = useLocale(settings.locale);
  const today = useToday();
  const suggestions = useTaskSuggestions();
  const [notice, setNotice] = useNotice();
  const [failedSubmissions, setFailedSubmissions] = useState<QuickTask[][]>([]);
  const retryingSubmissions = useRef(new Set<QuickTask[]>());
  const navigation = useBoardNavigation(settings.startView);
  const { filter, query, sort, setFilter, setQuery } = navigation;
  const inspector = useTaskInspector();
  const { selectedId, setSelectedId } = inspector;
  const fail = useCallback((code: string, retry?: () => void) => setNotice({
    kind: "error", text: errorMessage(t, code), ...(retry ? { action: { label: t.retry, run: () => { setNotice(null); retry(); } } } : {}),
  }), [t, setNotice]);
  const scheduled = useCallback((task: Task) => {
    if (!task.due || !today) return;
    const next = t.nextOccurrence(dueLabel(task.due, today, locale, t, settings.dateFormat));
    // Completing a repeating task keeps its Undo and adds when the next one is due.
    setNotice((current) => current?.kind === "ok" && current.undo && !current.onGone
      ? { ...current, text: `${current.text} ${next}` } : { kind: "ok", text: next });
  }, [today, locale, t, settings.dateFormat, setNotice]);
  const taskData = useTasks(fail, scheduled, (currentIds) => {
    if (selectedId && !currentIds.has(selectedId)) {
      inspector.close();
      if (page === "/") setNotice({ kind: "ok", text: t.taskDeletedElsewhere });
    }
  }, settings.aiProvider);
  const projectData = useProjects(taskData.clearProject, (ids) => {
    if (filter.kind !== "project" || ids.has(filter.id)) return;
    setSelectedId(null);
    setQuery("");
    setFilter({ kind: "all" });
    setNotice(null);
  });
  const { retryLoad, tasks } = taskData;
  useEffect(() => subscribeAgentUpdates(retryLoad), [retryLoad]);
  const { projects } = projectData;
  const view = useMemo(() => buildTaskView(tasks ?? [], filter, today ?? "", projects, query, sort),
    [tasks, filter, today, projects, query, sort]);
  const selectedTask = tasks?.find((task) => task.id === selectedId);

  const previousPage = useRef(page);
  const refreshTasks = taskData.retryLoad;
  const refreshProjects = projectData.retryLoad;
  useEffect(() => {
    if (previousPage.current === page) return;
    previousPage.current = page;
    setNotice(null);
    if (page !== "/") setSelectedId(null);
    refreshTasks();
    refreshProjects();
  }, [page, setSelectedId, refreshTasks, refreshProjects, setNotice]);

  function select(next: TaskFilter) {
    setSelectedId(null);
    // Changing list is no reason to lose the chance to undo what was just done.
    setQuery(""); setFilter(next); setNotice((current) => current?.undo ? current : null);
    if (page !== "/") router.push("/");
  }

  const focusRequest = useNavigationShortcuts({ page, select, push: (path) => router.push(path) });

  return { page, settings, locale, t, today, navigation, taskData, projectData, selectedTask, inspector,
    view, notice, setNotice, fail, select, suggestions, focusRequest, failedSubmissions, setFailedSubmissions, retryingSubmissions };
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
    <a className="skip-link" href="#main-content">{t.skipToContent}</a>
    <div className={`shell${page === "/" && selectedTask ? " has-inspector" : ""}`}>
      <Sidebar t={t} view={view} filter={navigation.filter} page={page} onFilter={select} pendingCount={workspace.suggestions.pendingCount}
        taskLoadFailed={page !== "/" && workspace.taskData.loadFailed} onRetryTasks={workspace.taskData.retryLoad}
        projectLoadFailed={projectData.loadFailed} onRetryProjects={projectData.retryLoad}
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
