"use client";

import type { QuickAddDefaults } from "@/features/quick-add/schema";
import { Icon } from "@/lib/Icon";
import { dueLabel, longDate } from "@/lib/dates";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rankDayTasks } from "../day-order";
import { useComposerSubmit } from "../use-composer-submit";
import { useDayOrder } from "../use-day-order";
import { isProvisional } from "../optimistic-tasks";
import { isForToday, type TaskSort } from "../selectors";
import { useTaskActions } from "../use-task-actions";
import { useTaskShortcuts } from "../use-task-shortcuts";
import { useTypeAhead } from "../use-type-ahead";
import { BoardHeader } from "./BoardHeader";
import { BoardNotice } from "./BoardNotice";
import { BoardSearch } from "./BoardSearch";
import { Composer } from "./Composer";
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
  const { filter, query, setQuery, sort, setSort, text, setText } = navigation;
  const { tasks, reorder, aiEnabled, add, capture, patch, changeLater, loadFailed, retryLoad } = taskData;
  const { projects } = projectData;
  const search = useRef<HTMLInputElement>(null);
  const loaded = tasks !== null;
  const [awaited, setAwaited] = useState(false);
  const { setSelectedId } = inspector;
  const labels = useMemo(() => ({
    completed: t.taskCompleted, reopened: t.taskReopened, deleted: t.taskDeleted, restored: t.taskRestored,
    next: (due: string) => today ? t.nextOccurrence(dueLabel(due, today, locale, t, settings.dateFormat)) : "",
    due: (title: string, due: string | null) => due && today ? t.taskDueSet(title, dueLabel(due, today, locale, t, settings.dateFormat)) : t.taskDueCleared(title),
  }), [t, today, locale, settings.dateFormat]);
  const actions = useTaskActions({
    tasks, patch, changeLater, notify: setNotice, labels, onElsewhere: () => select({ kind: "all" }),
    onLeave: useCallback((id: string) => setSelectedId((current) => current === id ? null : current), [setSelectedId]),
  });
  const { submit, keep, fresh } = useComposerSubmit({
    t, today, ready: tasks !== null, projects, defaultPriority: settings.defaultPriority, add, capture, setQuery, setNotice, show: actions.show, fail,
  });
  const dismiss = useCallback(() => setNotice(null), [setNotice]);
  const undo = () => { notice?.undo?.(); return Boolean(notice?.undo); };
  const toList = () => (actions.rows()[0] ?? document.getElementById("main-content"))?.focus();
  const title = filter.kind === "project" ? projects.find((p) => p.id === filter.id)?.name ?? t.projects
    : filter.kind === "tag" ? `#${filter.tag}` : filter.kind === "today" ? t.today : t.allTasks;

  const composerContext: QuickAddDefaults = filter.kind === "today" ? { plannedFor: today ?? undefined }
    : filter.kind === "project" ? { projectId: filter.id } : filter.kind === "tag" ? { tag: filter.tag } : {};

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
    tasks, rows: actions.rows, focusSearch: () => search.current?.focus(),
    focusComposer: () => { if (loaded) actions.focusComposer(); else setAwaited(true); },
    onToggle: (task) => { void actions.patchFromRow(task.id, { done: !task.done }); },
    onDelete: actions.requestDelete, onUndo: undo,
    // The search goes first and the task in focus stays where the keyboard is; then the details close.
    onBack: () => {
      if (query) setQuery("");
      else if (inspector.selectedId) inspector.close();
      else return false;
      return true;
    },
  });
  // The task field is not on screen while the list loads: what is typed for it meanwhile is kept and lands there.
  useTypeAhead(awaited && !loaded, (typed) => { if (typed) setText(text + typed); actions.focusComposer(); setAwaited(false); });
  // Most used first, so the tags a person reaches for are the ones offered.
  const savedTags = useMemo(() => [...view.tagCounts].sort((a, b) => b[1] - a[1]).map(([tag]) => tag), [view.tagCounts]);
  useEffect(() => {
    if (!loaded || !focusRequest.current) return;
    if (focusRequest.current === "search") search.current?.focus();
    else actions.focusComposer();
    focusRequest.current = null;
  }, [loaded, focusRequest, actions.focusComposer]);
  const searching = Boolean(query.trim());
  const dayIds = today ? rankDayTasks((tasks ?? []).filter((task) => !task.done && !isProvisional(task) && isForToday(task, today)), today).map((task) => task.id) : [];
  const order = useDayOrder(today, dayIds, filter.kind === "today" && sort === "manual", reorder, fail);
  const list = { suggestions: suggestions.byTask, order: order && searching ? { ...order, ready: false } : order, today: today ?? "", locale, t, projects, savedTags, dateFormat: settings.dateFormat, rowKey: taskData.rowKey, onPatch: actions.patchFromRow, onDelete: actions.requestDelete,
    onPostpone: postpone, selectedId: inspector.selectedId, onShowPanel: inspector.toggle, onTag: (tag: string) => select({ kind: "tag", tag }) };

  return <div className="board-content" ref={actions.root}>
    <main id="main-content" tabIndex={-1} className="panel">
      <div className="board-bar">
        <div className="board-location"><Icon name="grid" size={16} /><span>{t.workspace}</span>
          <Icon name="chevron-right" size={13} /><strong>{t.tasksLabel}</strong></div>
        <BoardSearch t={t} query={query} onQuery={setQuery} inputRef={search} rows={actions.rows} onLeave={toList} />
      </div>
      <div className="content">
        <BoardHeader title={title} t={t} today={today ?? ""} date={today ? longDate(today, locale, settings.dateFormat) : null}
          loading={!tasks && !loadFailed} failed={loadFailed} open={view.scopeOpen} done={view.scopeDone} />
        {tasks && <Composer t={t} text={text} onTextChange={setText} aiEnabled={aiEnabled} today={today ?? ""} locale={locale} dateFormat={settings.dateFormat} onSubmit={submit} onUnsaved={keep}
          context={composerContext} projects={projects} suggestions={savedTags}
          onLeave={toList} onUndo={undo} />}
        {!tasks && !loadFailed && <TaskSkeleton t={t} locale={locale} dateFormat={settings.dateFormat} projects={projects} />}
        <BoardNotice notice={notice} t={t} onDismiss={dismiss} />
        {loadFailed && <div className="board-failure"><p role="alert">{t.taskLoadFailed}</p>
          <button type="button" className="btn btn-secondary" onClick={() => { retryLoad(); document.getElementById("main-content")?.focus(); }}>{t.retry}</button></div>}
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
