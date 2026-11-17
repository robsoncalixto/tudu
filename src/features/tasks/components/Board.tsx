"use client";

import { useCallback, useMemo, useState } from "react";
import { errorMessage } from "@/i18n";
import { useLocale } from "@/i18n/use-locale";
import { dueLabel, longDate } from "@/lib/dates";
import { errorCode } from "@/lib/http";
import { useToday } from "@/lib/use-today";
import { buildTaskView, type TaskFilter } from "../selectors";
import { useTasks } from "../use-tasks";
import { useProjects } from "../use-projects";
import { Composer, type ComposerMode } from "./Composer";
import { Sidebar } from "./Sidebar";
import { TaskList } from "./TaskList";
import { ProjectManager } from "./ProjectManager";
import type { Settings } from "@/features/settings/schema";
import type { Task } from "../schema";
import { useTaskShortcuts } from "../use-task-shortcuts";
import { TaskShortcuts } from "./TaskShortcuts";

type Notice = { kind: "ok" | "error"; text: string } | null;

export function Board({ settings }: { settings: Settings }) {
  const { locale, t } = useLocale(settings.locale);
  const today = useToday();
  const [notice, setNotice] = useState<Notice>(null);
  const [filter, setFilter] = useState<TaskFilter>({ kind: settings.startView });
  const tagFilter = filter.kind === "tag" ? filter.tag : null;
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());

  const fail = useCallback((code: string) => setNotice({ kind: "error", text: errorMessage(t, code) }), [t]);
  const scheduled = useCallback((task: Task) => {
    if (task.due && today) setNotice({ kind: "ok", text: t.nextOccurrence(dueLabel(task.due, today, locale, t, settings.dateFormat)) });
  }, [today, locale, t, settings.dateFormat]);
  const { tasks, aiEnabled, add, capture, patch, remove, clearProject } = useTasks(fail, scheduled);
  const shortcuts = useTaskShortcuts(tasks, patch, remove);
  const { projects, createProject, renameProject, deleteProject } = useProjects(fail, clearProject);
  const view = useMemo(() => buildTaskView(tasks ?? [], filter, today ?? "", projects), [tasks, filter, today, projects]);
  const projectName = filter.kind === "project" ? projects.find((project) => project.id === filter.id)?.name : null;

  async function submit(mode: ComposerMode, text: string): Promise<boolean> {
    if (!today) return false;
    setNotice(null);
    try {
      const created =
        mode === "ai" ? await capture(text, today) : await add(text, today);
      setFresh(new Set(created.map((task) => task.id)));
      setFilter({ kind: "all" });
      if (mode === "ai") setNotice({ kind: "ok", text: t.added(created.length) });
      return true;
    } catch (error) {
      fail(errorCode(error));
      return false;
    }
  }

  const date = today ? longDate(today, locale, settings.dateFormat) : null;
  const list = {
    today: today ?? "", locale, t, projects, dateFormat: settings.dateFormat, onPatch: patch, onDelete: shortcuts.requestDelete,
    onTag: (tag: string) => setFilter({ kind: "tag", tag }),
  };

  return (
    <div className="shell" ref={shortcuts.root}>
      <TaskShortcuts t={t} {...shortcuts.dialogProps} />
      <Sidebar
        t={t}
        openCount={view.openCount}
        todayCount={view.todayCount}
        tagCounts={view.tagCounts}
        projectCounts={view.projectCounts}
        filter={filter}
        onFilter={setFilter}
        onShortcuts={shortcuts.showHelp}
      />

      <main className="panel">
        <div className="content">
          <header className="day">
            <p className="eyebrow">{date ? date.weekday : " "}</p>
            <h1>{date ? date.rest : " "}</h1>
            <div className="tally">
              {tasks ? (
                <>
                  <span className="chip">{t.countOpen(view.openCount)}</span>
                  <span className="chip chip-success">{t.countDone(tasks.length - view.openCount)}</span>
                </>
              ) : (
                <span className="chip">{t.loading}</span>
              )}
            </div>
          </header>

          <ProjectManager projects={projects} t={t} onCreate={createProject} onRename={renameProject}
            onDelete={async (id) => {
              if (!await deleteProject(id)) return false;
              setFilter((current) => current.kind === "project" && current.id === id ? { kind: "all" } : current);
              return true;
            }} />
          <Composer t={t} aiEnabled={aiEnabled} onSubmit={submit} />

          <p className={`notice${notice ? ` is-${notice.kind}` : ""}`} role="status">
            {notice?.text}
          </p>

          {tasks && (
            <>
              <section aria-labelledby="open-heading">
                <h2 id="open-heading" className="section-title">
                  {projectName ?? (tagFilter ? `#${tagFilter}` : filter.kind === "today" ? t.today : t.open)} <span>{view.open.length}</span>
                </h2>
                {view.open.length === 0 ? (
                  <div className="card empty">
                    <p className="empty-title">{projectName ? t.emptyProject : tagFilter ? t.emptyFiltered : filter.kind === "today" ? t.emptyToday : t.emptyTitle}</p>
                    {!tagFilter && !projectName && <p>{filter.kind === "today" ? t.emptyTodayBody : t.emptyBody}</p>}
                  </div>
                ) : (
                  <TaskList tasks={view.open} header fresh={fresh} {...list} />
                )}
              </section>

              {view.done.length > 0 && (
                <details className="done">
                  <summary className="section-title">
                    {t.done} <span>{view.done.length}</span>
                  </summary>
                  <TaskList tasks={view.done} {...list} />
                </details>
              )}
            </>
          )}

          <footer className="colophon">{t.tagline}</footer>
        </div>
      </main>
    </div>
  );
}
