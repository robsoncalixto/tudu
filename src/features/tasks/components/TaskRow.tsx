"use client";

import { useId, useRef, useState } from "react";
import { dayDiff, dueLabel, longDate, type DateFormat } from "@/lib/dates";
import { Icon } from "@/lib/Icon";
import type { Dictionary, Locale } from "@/i18n";
import type { Project } from "@/features/projects/schema";
import { PRIORITIES, type Priority, type Task } from "../schema";
import { nextSubtaskVisibility, stepProgress, type SubtaskVisibility } from "../checklist";
import { repeatDescription } from "../recurrence";
import { isPlannedForToday } from "../selectors";
import { TASK_ORDER_DRAG_TYPE } from "../use-day-order";
import { TaskOrderControls } from "./TaskOrderControls";
import type { TaskActions } from "./TaskList";
import { TaskChecklist } from "./TaskChecklist";

interface Props extends TaskActions {
  task: Task;
  projects: Project[];
  fresh?: boolean;
  today: string;
  locale: Locale;
  dateFormat: DateFormat;
  t: Dictionary;
}

export function TaskRow({ task, projects, fresh, today, locale, dateFormat, t, order, onPatch, selectedId, onShowPanel, onTag }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const selected = selectedId === task.id;
  const [visibility, setVisibility] = useState<SubtaskVisibility>("all");
  const [adding, setAdding] = useState(false);
  const subtasksId = useId();
  const addButton = useRef<HTMLButtonElement>(null);
  const subtaskInput = useRef<HTMLInputElement>(null);
  const titleButton = useRef<HTMLButtonElement>(null);
  const overdue = !task.done && task.due !== null && dayDiff(task.due, today) < 0;
  const project = projects.find((item) => item.id === task.projectId);
  const steps = stepProgress(task.steps);
  const nextVisibility = nextSubtaskVisibility(visibility, steps);
  const visibilityLabel = { all: t.showSubtasks, open: t.hideDoneSubtasks, collapsed: t.hideSubtasks }[nextVisibility];
  const planned = isPlannedForToday(task, today);
  const earlierPlan = planned && task.plannedFor && task.plannedFor < today ? task.plannedFor : null;
  const planLabel = planned ? t.removeFromToday : t.addToToday;
  const hasMetadata = project || task.tags.length > 0 || steps.total > 0 || task.repeat || earlierPlan;

  function commit() {
    const title = draft.trim();
    setEditing(false);
    if (title && title !== task.title) void onPatch(task.id, { title });
  }

  return (
    <li className={`task${task.done ? " is-done" : ""}${fresh ? " is-new" : ""}`} data-priority={task.priority}
      data-task-id={task.id} data-inspected={selected || undefined} tabIndex={-1} aria-label={task.title}
      onDragOver={(event) => {
        if (order?.ready && order.positions.has(task.id) && event.dataTransfer.types.includes(TASK_ORDER_DRAG_TYPE)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(event) => {
        const target = order?.positions.get(task.id);
        if (!order?.ready || target === undefined) return;
        const id = event.dataTransfer.getData(TASK_ORDER_DRAG_TYPE);
        if (id) { event.preventDefault(); order.move(id, target); }
      }}>
      <button type="button" className="check" role="checkbox" aria-checked={task.done}
        aria-label={task.done ? t.markOpen : t.markDone} onClick={() => onPatch(task.id, { done: !task.done })}>
        {task.done && <Icon name="check" size={14} />}
      </button>
      <div className="task-body">
        {order && <TaskOrderControls id={task.id} t={t} order={order} />}
        {editing ? (
          <input className="form-control task-edit" value={draft} autoFocus maxLength={300} aria-label={t.editTitle}
            onChange={(event) => setDraft(event.target.value)} onBlur={commit}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== "Escape") return;
              event.preventDefault();
              if (event.key === "Enter") event.currentTarget.blur();
              else setEditing(false);
              requestAnimationFrame(() => {
                if (document.activeElement === document.body) titleButton.current?.focus();
              });
            }} />
        ) : (
          <button type="button" className="task-title" ref={titleButton} title={t.editTitle}
            onClick={() => { setDraft(task.title); setEditing(true); }}>{task.title}</button>
        )}
        {task.notes && <p className="task-notes is-preview">{task.notes}</p>}
        {hasMetadata && <div className="task-metadata">
          {earlierPlan && <span><Icon name="sun" size={13} />
            <time dateTime={earlierPlan}>{t.plannedEarlier(longDate(earlierPlan, locale, dateFormat).rest)}</time>
          </span>}
          {project && <span><Icon name="folder" size={13} />{project.name}</span>}
          {task.tags.map((tag) => <button type="button" key={tag} onClick={() => onTag(tag)}>#{tag}</button>)}
          {steps.total > 0 && <button type="button" className="subtask-count" id={`${subtasksId}-toggle`} aria-label={visibilityLabel}
            title={visibilityLabel} aria-controls={subtasksId} aria-describedby={`${subtasksId}-count`}
            aria-expanded={nextVisibility !== "all"} onClick={() => setVisibility(nextVisibility)}>
            <Icon name={nextVisibility === "all" ? "chevron-right" : "chevron-down"} size={14} />
            <span id={`${subtasksId}-count`}>{t.stepCount(steps.done, steps.total)}</span>
          </button>}
          {task.repeat && <span title={repeatDescription(task.repeat, locale, t)}><Icon name="repeat" size={13} />{t.repeatFrequencies[task.repeat.frequency]}</span>}
        </div>}
      </div>

      <div className="task-schedule">
        <label className={`task-date${overdue ? " is-overdue" : ""}`}>
          <Icon name="calendar" size={14} />
          <span>{task.due ? dueLabel(task.due, today, locale, t, dateFormat) : t.noDate}{overdue && ` · ${t.overdue}`}</span>
          <input type="date" value={task.due ?? ""} aria-label={t.setDate}
            onChange={(event) => onPatch(task.id, { due: event.target.value || null })} />
        </label>
        <div className="task-priority">
          <span className="priority-mark" aria-hidden />
          <select className="select-control" aria-label={t.priority} value={task.priority}
            onChange={(event) => onPatch(task.id, { priority: event.target.value as Priority })}>
            {PRIORITIES.map((value) => <option key={value} value={value}>{t[value]}</option>)}
          </select>
        </div>
      </div>

      <div className="task-tools">
        <button type="button" className="subtask-add" data-add-subtask aria-label={t.addStep}
          title={steps.total >= 100 ? t.stepLimit : t.addStep} ref={addButton} disabled={steps.total >= 100}
          aria-controls={subtasksId} onClick={() => {
            setVisibility("all"); setAdding(true);
            requestAnimationFrame(() => subtaskInput.current?.focus());
          }}><Icon name="subtask-add" size={18} /></button>
        {!task.done && <button type="button" className="plan-today" aria-pressed={planned}
          aria-label={planLabel} title={planLabel} disabled={!today}
          onClick={() => onPatch(task.id, { plannedFor: planned ? null : today })}><Icon name="sun" size={16} /></button>}
        <button type="button" className="task-disclosure" title={`${t.taskDetails} (I)`} aria-label={t.taskDetails}
          data-open-panel aria-keyshortcuts="I" aria-expanded={selected} aria-controls={selected ? "task-inspector" : undefined}
          onClick={(event) => onShowPanel(task.id, event.currentTarget)}>
          <Icon name={selected ? "x" : "panel-right"} size={18} />
        </button>
      </div>

      <TaskChecklist id={subtasksId} steps={task.steps} t={t} visibility={visibility} adding={adding}
        inputRef={subtaskInput} addButton={addButton} onCloseAdd={() => {
          setAdding(false);
          (addButton.current?.disabled ? document.getElementById(`${subtasksId}-toggle`) : addButton.current)?.focus();
        }}
        onChange={(steps) => onPatch(task.id, { steps })} />
    </li>
  );
}
