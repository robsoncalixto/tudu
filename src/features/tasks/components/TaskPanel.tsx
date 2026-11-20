"use client";

import { useState } from "react";
import type { Project } from "@/features/projects/schema";
import type { Dictionary, Locale } from "@/i18n";
import { dueLabel, formatTimestamp, toISODate, type DateFormat } from "@/lib/dates";
import { Icon, type IconName } from "@/lib/Icon";
import { PARTS_OF_DAY, partOfDaySchema, PRIORITIES, type DurationDraft, type Task, type TaskPatch } from "../schema";
import { useTaskDraft } from "../use-task-draft";
import { TaskPanelSubtasks } from "./TaskChecklist";
import { TaskPanelText } from "./TaskPanelText";
import { TaskRepeat } from "./TaskRepeat";
import { TaskLinks } from "./TaskResources";
import { TaskDuration } from "./TaskDuration";
import { TaskSuggestionActions, TaskSuggestionField } from "./TaskSuggestions";
import type { ContextProposal, SuggestedField } from "../task-suggestions";
import "./task-panel.css";

interface Props {
  task: Task;
  proposals: ContextProposal[];
  projects: Project[];
  today: string;
  locale: Locale;
  dateFormat: DateFormat;
  t: Dictionary;
  onPatch: (id: string, changes: TaskPatch) => Promise<boolean>;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function TaskPanel({ task, proposals, projects, today, locale, dateFormat, t, onPatch, onDelete, onClose }: Props) {
  const title = useTaskDraft<string>(task.id);
  const notes = useTaskDraft<string>(task.id);
  const tags = useTaskDraft<string>(task.id);
  const estimate = useTaskDraft<DurationDraft>(task.id);
  const realTime = useTaskDraft<DurationDraft>(task.id);
  const links = useTaskDraft<string>(task.id);
  const [failed, setFailed] = useState<{ id: string; changes?: TaskPatch } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const textProps = { task, t, onPatch };

  async function patch(id: string, changes: TaskPatch, retryable = true) {
    setFailed(null);
    const ok = await onPatch(id, changes);
    if (!ok) setFailed({ id, changes: retryable ? changes : undefined });
    return ok;
  }

  function dateField(field: "plannedFor" | "due", label: string, icon: IconName) {
    const value = task[field];
    return <label className="inspector-property">
      <span className="inspector-label"><Icon name={icon} size={17} />{label}</span>
      <span className="task-date inspector-date">
        <span>{value ? dueLabel(value, today, locale, t, dateFormat) : t.noDate}</span>
        <Icon name="calendar" size={14} />
        <input type="date" aria-label={label} value={value ?? ""}
          onChange={(event) => void patch(task.id, { [field]: event.target.value || null })} />
      </span>
    </label>;
  }

  const suggestion = (field: SuggestedField) => <TaskSuggestionField field={field} proposals={proposals}
    projects={projects} today={today} locale={locale} t={t} dateFormat={dateFormat} />;

  return <aside id="task-inspector" className="task-inspector" aria-label={t.taskDetails}>
    <header className="inspector-header">
      <TaskPanelText key={task.id} field="title" {...textProps} {...title} />
      <button type="button" className="inspector-icon inspector-close" aria-label={t.closeTaskDetails} title={t.closeTaskDetails}
        data-close-panel onClick={onClose}><Icon name="panel-right" size={19} /></button>
    </header>
    <div className="inspector-content">
      {suggestion("title")}
      <TaskPanelSubtasks taskId={task.id} t={t} steps={task.steps} onChange={(steps) => patch(task.id, { steps }, false)} />
      {suggestion("steps")}
      <TaskDuration key={`estimate-${task.id}`} field="estimateHours" {...textProps} {...estimate} />
      <TaskDuration key={`real-time-${task.id}`} field="realTimeHours" {...textProps} {...realTime} />
      {dateField("plannedFor", t.agentPlannedFor, "calendar")}
      {suggestion("plannedFor")}
      <label className="inspector-property">
        <span className="inspector-label"><Icon name="clock" size={17} />{t.partOfDay}</span>
        <select className="select-control" value={task.partOfDay ?? ""} onChange={(event) => {
          void patch(task.id, { partOfDay: event.target.value ? partOfDaySchema.parse(event.target.value) : null });
        }}>
          <option value="">{t.anyPartOfDay}</option>
          {PARTS_OF_DAY.map((part) => <option value={part} key={part}>{t.partsOfDay[part]}</option>)}
        </select>
      </label>
      {suggestion("partOfDay")}
      {dateField("due", t.setDate, "flag")}
      {suggestion("due")}
      <label className="inspector-property">
        <span className="inspector-label"><Icon name="sort" size={17} />{t.priority}</span>
        <select className="select-control" aria-label={t.priority} value={task.priority}
          onChange={(event) => void patch(task.id, { priority: event.target.value as Task["priority"] })}>
          {PRIORITIES.map((value) => <option key={value} value={value}>{t[value]}</option>)}
        </select>
      </label>
      {suggestion("priority")}
      <label className="inspector-property">
        <span className="inspector-label"><Icon name="folder" size={17} />{t.project}</span>
        <select className="select-control" aria-label={t.project} value={task.projectId ?? ""} disabled={!projects.length}
          onChange={(event) => void patch(task.id, { projectId: event.target.value || null })}>
          <option value="">{t.noProject}</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </label>
      {suggestion("projectId")}
      <TaskPanelText key={`tags-${task.id}`} field="tags" {...textProps} {...tags} />
      {suggestion("tags")}
      <TaskRepeat task={task} today={today} locale={locale} t={t}
        onChange={(changes) => patch(task.id, changes, false)} />
      <TaskPanelText key={`notes-${task.id}`} field="notes" {...textProps} {...notes} />
      {suggestion("notes")}
      <TaskSuggestionActions proposals={proposals} t={t} />
      <TaskLinks key={`links-${task.id}`} {...textProps} {...links} />
      <footer className="inspector-footer">
        <span>{t.taskCreated(dateFormat === "iso" ? toISODate(new Date(task.createdAt)) : formatTimestamp(task.createdAt, locale))}</span>
        <button type="button" className="inspector-delete" onClick={() => onDelete(task.id)}>
          <Icon name="trash" size={15} />{t.delete}
        </button>
      </footer>
    </div>
    {failed?.id === task.id && <div className="inspector-save-error" role="alert">
      <span>{t.errors.generic}</span>{failed.changes && <button type="button" className="chip" disabled={retrying} onClick={async () => {
        if (!failed.changes) return;
        setRetrying(true);
        try { await patch(task.id, failed.changes); } finally { setRetrying(false); }
      }}>{t.retry}</button>}
    </div>}
  </aside>;
}
