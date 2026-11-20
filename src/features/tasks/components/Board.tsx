"use client";

import type { QuickAddDefaults } from "@/features/quick-add/schema";
import { Icon } from "@/lib/Icon";
import { longDate } from "@/lib/dates";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shortcutsApi } from "@/features/shortcuts/api";
import { errorCode } from "@/lib/http";
import type { Task } from "../schema";
import { rankDayTasks } from "../day-order";
import { useDayOrder } from "../use-day-order";
import { isProvisional } from "../optimistic-tasks";
import { isForToday, isInFilter, type TaskSort } from "../selectors";
import { useTaskActions } from "../use-task-actions";
import { useTaskShortcuts } from "../use-task-shortcuts";
import { BoardHeader } from "./BoardHeader";
import { BoardNotice } from "./BoardNotice";
import { Composer, type ComposerMode } from "./Composer";
import { postponementDate, type Postponement } from "../planning";
import { TaskEmpty } from "./TaskEmpty";
import { TaskList } from "./TaskList";
import { TaskPanel } from "./TaskPanel";
import { TaskPanelFrame } from "./TaskPanelFrame";
import { TaskSkeleton } from "./TaskSkeleton";
import { useTaskWorkspace } from "./TaskWorkspace";

export function Board() {
  const { settings, locale, t, today, navigation, inspector, taskData, projectData, selectedTask,
    view, notice, setNotice, fail, select, suggestions, focusRequest } = useTaskWorkspace();
  const { filter, setFilter, query, setQuery, sort, setSort, text, setText } = navigation;
  const { tasks, reorder, aiEnabled, add, capture, patch, removeLater, loadFailed, retryLoad } = taskData;
  const { projects } = projectData;
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const search = useRef<HTMLInputElement>(null);
  const { setSelectedId } = inspector;
  const labels = useMemo(() => ({ completed: t.taskCompleted, reopened: t.taskReopened, deleted: t.taskDeleted, undo: t.undo }), [t]);
  const actions = useTaskActions({
    tasks, patch, removeLater, notify: setNotice, labels,
    onLeave: useCallback((id: string) => setSelectedId((current) => current === id ? null : current), [setSelectedId]),
  });
  const dismiss = useCallback(() => setNotice(null), [setNotice]);
  const undo = () => { notice?.action?.run(); return Boolean(notice?.action); };
  const title = filter.kind === "project" ? projects.find((p) => p.id === filter.id)?.name ?? t.projects
    : filter.kind === "tag" ? `#${filter.tag}` : filter.kind === "today" ? t.today : t.allTasks;

  const composerContext: QuickAddDefaults = filter.kind === "today" ? { plannedFor: today ?? undefined }
    : filter.kind === "project" ? { projectId: filter.id } : filter.kind === "tag" ? { tag: filter.tag } : {};

  async function submit(mode: ComposerMode, text: string, defaults: QuickAddDefaults) {
    if (!today || !tasks) return false;
    setNotice(null);
    try {
      if (mode === "add") {
        const { shown, saved } = add(text, today, defaults, projects, settings.defaultPriority);
        setFresh(new Set(shown.map((task) => task.id)));
        setQuery("");
        const created = await saved;
        // A chip can send the task out of this view; say that it was still saved.
        if (created.some((task) => !isInFilter(task, filter, today))) setNotice({ kind: "ok", text: t.added(created.length) });
        return true;
      }
      const { tag, tags, projectId, plannedFor, priority, due } = defaults;
      const aiTags = [...new Set([...(tags ?? []), ...(tag ? [tag] : [])])];
      const created = await capture(text, today, {
        ...(priority ? { priority } : {}), ...(due ? { due } : {}),
        ...(projectId ? { projectId } : {}), ...(plannedFor ? { plannedFor } : {}),
        ...(aiTags.length ? { tags: aiTags } : {}),
      });
      setFresh(new Set(created.map((task) => task.id)));
      setQuery("");
      setFilter({ kind: "all" });
      setNotice({ kind: "ok", text: t.added(created.length) });
      return true;
    } catch (error) { fail(errorCode(error)); return false; }
  }

  async function postpone(id: string, when: Postponement) {
    if (!today) return;
    setNotice(null);
    const plannedFor = postponementDate(today, when);
    if (await actions.patchFromRow(id, { plannedFor })) {
      setNotice({ kind: "ok", text: t.taskPostponed(longDate(plannedFor, locale, settings.dateFormat).rest) });
    }
  }

  function clearSearch() { setQuery(""); search.current?.focus(); }
  useTaskShortcuts({
    tasks, rows: actions.rows, focusComposer: actions.focusComposer, focusSearch: () => search.current?.focus(),
    onToggle: (task) => { void actions.patchFromRow(task.id, { done: !task.done }); },
    onDelete: actions.requestDelete, onUndo: undo,
  });
  const savedTags = useMemo(() => view.tagCounts.map(([tag]) => tag), [view.tagCounts]);
  const loaded = tasks !== null;
  useEffect(() => {
    if (!loaded || !focusRequest.current) return;
    if (focusRequest.current === "search") search.current?.focus();
    else actions.focusComposer();
    focusRequest.current = null;
  }, [loaded, focusRequest, actions.focusComposer]);
  const searching = Boolean(query.trim());
  const dayIds = today ? rankDayTasks((tasks ?? []).filter((task) => !task.done && !isProvisional(task) && isForToday(task, today)), today).map((task) => task.id) : [];
  const order = useDayOrder(today, dayIds, filter.kind === "today" && sort === "manual", reorder, fail);
  const list = { suggestions: suggestions.byTask, order: order && searching ? { ...order, ready: false } : order, today: today ?? "", locale, t, projects, savedTags, dateFormat: settings.dateFormat, onPatch: actions.patchFromRow,
    onPostpone: postpone, selectedId: inspector.selectedId, onShowPanel: inspector.toggle, onTag: (tag: string) => select({ kind: "tag", tag }) };

  return <div className="board-content" ref={actions.root}>
    <main id="main-content" tabIndex={-1} className="panel">
      <div className="board-bar">
        <div className="board-location"><Icon name="grid" size={16} /><span>{t.workspace}</span>
          <Icon name="chevron-right" size={13} /><strong>{t.tasksLabel}</strong></div>
        <div className="board-search" role="search">
          <label htmlFor="board-query" aria-label={t.taskSearch}><Icon name="search" size={17} /></label><input ref={search} type="search" id="board-query" value={query} aria-label={t.taskSearch}
            placeholder={t.taskSearch} onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              const keys = shortcutsApi.match("search", event);
              if (keys.includes("clearSearch") && query) clearSearch();
              else if (keys.includes("searchResults") && actions.rows().length) { event.preventDefault(); actions.rows()[0].focus(); }
            }} />
          {query && <button type="button" className="icon-btn" aria-label={t.clearSearch} onClick={clearSearch}><Icon name="x" size={14} /></button>}
        </div>
      </div>
      <div className="content">
        <BoardHeader title={title} t={t} today={today ?? ""} date={today ? longDate(today, locale, settings.dateFormat) : null}
          loading={!tasks && !loadFailed} failed={loadFailed} open={view.scopeOpen} done={view.scopeDone} />
        {tasks && <Composer t={t} text={text} onTextChange={setText} aiEnabled={aiEnabled} today={today ?? ""} locale={locale} dateFormat={settings.dateFormat} onSubmit={submit}
          context={composerContext} projects={projects} suggestions={savedTags}
          onLeave={() => (actions.rows()[0] ?? document.getElementById("main-content"))?.focus()} onUndo={undo} />}
        {!tasks && !loadFailed && <TaskSkeleton />}
        <BoardNotice notice={notice} t={t} onDismiss={dismiss} />
        {loadFailed && <div className="board-failure"><p role="alert">{t.taskLoadFailed}</p>
          <button type="button" className="btn btn-secondary" onClick={retryLoad}>{t.retry}</button></div>}
        {tasks && <>
          <section aria-labelledby="open-heading">
            <div className="list-toolbar">
              <h2 id="open-heading" className="section-title">{t.open} <span>{view.open.length}</span></h2>
              {view.scopeOpen > 0 && <label className="board-sort"><Icon name="sort" size={16} />
                <select className="select-control" aria-label={t.sortTasks} value={sort} onChange={(event) => setSort(event.target.value as TaskSort)}>
                  {filter.kind === "today" && <option value="manual">{t.sortManual}</option>}
                  <option value="due">{t.sortDue}</option><option value="priority">{t.sortPriority}</option><option value="newest">{t.sortNewest}</option>
                </select></label>}
            </div>
            {view.open.length ? <TaskList tasks={view.open} header fresh={fresh} {...list} /> :
              !(searching && view.done.length) && <TaskEmpty t={t} filter={filter} searching={searching}
                onAction={searching ? clearSearch : () => actions.root.current?.querySelector("textarea")?.focus()} />}
          </section>
          {view.done.length > 0 && <details key={searching ? "matches" : "done"} className="done" open={searching || undefined}>
            <summary className="section-title">{t.done} <span>{view.done.length}</span></summary><TaskList tasks={view.done} {...list} />
          </details>}
        </>}
      </div>
    </main>
    {selectedTask && <TaskPanelFrame label={t.taskDetails} resizeLabel={t.resizeTaskPanel} taskId={selectedTask.id} onClose={inspector.close}>
      <TaskPanel task={selectedTask} projects={projects} today={today ?? ""} locale={locale} dateFormat={settings.dateFormat}
        t={t} proposals={suggestions.byTask.get(selectedTask.id) ?? []} onPatch={patch} onDelete={actions.requestDelete} onClose={inspector.close} />
    </TaskPanelFrame>}
  </div>;
}
