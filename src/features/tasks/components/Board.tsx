"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { QuickAddDefaults } from "@/features/quick-add/schema";
import type { Settings } from "@/features/settings/schema";
import { errorMessage } from "@/i18n";
import { useLocale } from "@/i18n/use-locale";
import { Icon } from "@/lib/Icon";
import { dueLabel, longDate } from "@/lib/dates";
import { errorCode } from "@/lib/http";
import { useToday } from "@/lib/use-today";
import type { Task } from "../schema";
import { buildTaskView, type TaskFilter, type TaskSort } from "../selectors";
import { useProjects } from "../use-projects";
import { useTaskShortcuts } from "../use-task-shortcuts";
import { useBoardNavigation } from "../use-board-navigation";
import { useTasks } from "../use-tasks";
import { useTaskInspector } from "../use-task-inspector";
import { BoardHeader } from "./BoardHeader";
import { Composer, type ComposerMode } from "./Composer";
import { Sidebar } from "./Sidebar";
import { TaskContextMenu } from "./TaskContextMenu";
import { TaskEmpty } from "./TaskEmpty";
import { TaskList } from "./TaskList";
import { TaskPanel } from "./TaskPanel";
import { TaskPanelFrame } from "./TaskPanelFrame";
import { TaskShortcuts } from "./TaskShortcuts";
import "./board.css";

type Notice = { kind: "ok" | "error"; text: string } | null;

export function Board({ settings }: { settings: Settings }) {
  const { locale, t } = useLocale(settings.locale);
  const today = useToday();
  const [notice, setNotice] = useState<Notice>(null);
  const { filter, setFilter, query, setQuery, sort, setSort, text, setText, rememberForSettings } = useBoardNavigation(settings.startView);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const search = useRef<HTMLInputElement>(null);
  const fail = useCallback((code: string) => setNotice({ kind: "error", text: errorMessage(t, code) }), [t]);
  const scheduled = useCallback((task: Task) => {
    if (task.due && today) setNotice({ kind: "ok", text: t.nextOccurrence(dueLabel(task.due, today, locale, t, settings.dateFormat)) });
  }, [today, locale, t, settings.dateFormat]);
  const { tasks, aiEnabled, add, capture, patch, remove, clearProject, loadFailed, retryLoad } = useTasks(fail, scheduled);
  const inspector = useTaskInspector();
  const selectedTask = tasks?.find((task) => task.id === inspector.selectedId);
  const shortcuts = useTaskShortcuts(tasks, patch, async (id) => {
    const removed = await remove(id);
    if (removed) inspector.setSelectedId((current) => current === id ? null : current);
    return removed;
  });
  const { projects, projectError, clearProjectError, createProject, renameProject, deleteProject } = useProjects(fail, clearProject);
  const view = useMemo(() => buildTaskView(tasks ?? [], filter, today ?? "", projects, query, sort),
    [tasks, filter, today, projects, query, sort]);
  const title = filter.kind === "project" ? projects.find((p) => p.id === filter.id)?.name ?? t.projects
    : filter.kind === "tag" ? `#${filter.tag}` : filter.kind === "today" ? t.today : t.allTasks;

  function select(next: TaskFilter) {
    inspector.setSelectedId(null);
    setQuery(""); setFilter(next); setNotice(null);
  }

  const composerContext: QuickAddDefaults = filter.kind === "today" ? { plannedFor: today ?? undefined }
    : filter.kind === "project" ? { projectId: filter.id } : filter.kind === "tag" ? { tag: filter.tag } : {};

  async function submit(mode: ComposerMode, text: string, defaults: QuickAddDefaults) {
    if (!today || !tasks) return false;
    setNotice(null);
    try {
      const { tag, tags, projectId, plannedFor, priority, due } = defaults;
      const aiTags = [...new Set([...(tags ?? []), ...(tag ? [tag] : [])])];
      const created = mode === "ai" ? await capture(text, today, {
        ...(priority ? { priority } : {}), ...(due ? { due } : {}),
        ...(projectId ? { projectId } : {}), ...(plannedFor ? { plannedFor } : {}),
        ...(aiTags.length ? { tags: aiTags } : {}),
      }) : await add(text, today, defaults, projects);
      setFresh(new Set(created.map((task) => task.id)));
      setQuery("");
      if (mode === "ai") { setFilter({ kind: "all" }); setNotice({ kind: "ok", text: t.added(created.length) }); }
      return true;
    } catch (error) { fail(errorCode(error)); return false; }
  }

  function clearSearch() { setQuery(""); search.current?.focus(); }
  const searching = Boolean(query.trim());
  const list = { today: today ?? "", locale, t, projects, dateFormat: settings.dateFormat, onPatch: shortcuts.patchFromRow,
    selectedId: inspector.selectedId, onShowPanel: inspector.toggle, onTag: (tag: string) => select({ kind: "tag", tag }) };

  return <div className={`shell${selectedTask ? " has-inspector" : ""}`} ref={shortcuts.root}>
    <TaskContextMenu board={shortcuts.root} t={t} />
    <TaskShortcuts t={t} {...shortcuts.dialogProps} />
    <Sidebar t={t} view={view} filter={filter} onFilter={select} onOpenSettings={rememberForSettings} onShortcuts={shortcuts.showHelp}
      projectManager={{ projects, error: projectError ? errorMessage(t, projectError) : "",
        clearError: clearProjectError, onCreate: createProject, onRename: renameProject, onDelete: async (id) => {
          if (!await deleteProject(id)) return false;
          if (filter.kind === "project" && filter.id === id) select({ kind: "all" });
          return true;
        } }} />
    <main className="panel">
      <div className="board-bar">
        <div className="board-location"><Icon name="grid" size={16} /><span>{t.workspace}</span>
          <Icon name="chevron-right" size={13} /><strong>{t.tasksLabel}</strong></div>
        <div className="board-search" role="search">
          <label htmlFor="board-query" aria-label={t.taskSearch}><Icon name="search" size={17} /></label><input ref={search} type="search" id="board-query" value={query} aria-label={t.taskSearch}
            placeholder={t.taskSearch} onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Escape" && query) clearSearch(); }} />
          {query && <button type="button" className="icon-btn" aria-label={t.clearSearch} onClick={clearSearch}><Icon name="x" size={14} /></button>}
        </div>
      </div>
      <div className="content">
        <BoardHeader title={title} t={t} today={today ?? ""} date={today ? longDate(today, locale, settings.dateFormat) : null}
          loading={!tasks && !loadFailed} failed={loadFailed} open={view.scopeOpen} done={view.scopeDone} />
        {tasks && <Composer t={t} text={text} onTextChange={setText} onOpenSettings={rememberForSettings} aiEnabled={aiEnabled} today={today ?? ""} locale={locale} dateFormat={settings.dateFormat} onSubmit={submit}
          defaultPriority={settings.defaultPriority} context={composerContext} projects={projects} suggestions={view.tagCounts.map(([tag]) => tag)} />}
        <p className={`board-notice notice${notice ? ` is-${notice.kind}` : ""}`} role="status">{notice?.text}</p>
        {loadFailed && <div className="board-failure"><p role="alert">{t.taskLoadFailed}</p>
          <button type="button" className="btn btn-secondary" onClick={retryLoad}>{t.retry}</button></div>}
        {tasks && <>
          <section aria-labelledby="open-heading">
            <div className="list-toolbar">
              <h2 id="open-heading" className="section-title">{t.open} <span>{view.open.length}</span></h2>
              {view.scopeOpen > 0 && <label className="board-sort"><Icon name="sort" size={16} />
                <select className="select-control" aria-label={t.sortTasks} value={sort} onChange={(event) => setSort(event.target.value as TaskSort)}>
                  <option value="due">{t.sortDue}</option><option value="priority">{t.sortPriority}</option><option value="newest">{t.sortNewest}</option>
                </select></label>}
            </div>
            {view.open.length ? <TaskList tasks={view.open} header fresh={fresh} {...list} /> :
              !(searching && view.done.length) && <TaskEmpty t={t} filter={filter} searching={searching}
                onAction={searching ? clearSearch : () => shortcuts.root.current?.querySelector("textarea")?.focus()} />}
          </section>
          {view.done.length > 0 && <details key={searching ? "matches" : "done"} className="done" open={searching || undefined}>
            <summary className="section-title">{t.done} <span>{view.done.length}</span></summary><TaskList tasks={view.done} {...list} />
          </details>}
        </>}
      </div>
    </main>
    {selectedTask && <TaskPanelFrame label={t.taskDetails} taskId={selectedTask.id} onClose={inspector.close}>
      <TaskPanel task={selectedTask} projects={projects} today={today ?? ""} locale={locale} dateFormat={settings.dateFormat}
        t={t} onPatch={patch} onDelete={shortcuts.requestDelete} onClose={inspector.close} />
    </TaskPanelFrame>}
  </div>;
}
