"use client";

import { useState } from "react";
import { dayDiff, dueLabel } from "@/lib/dates";
import type { Dictionary, Locale } from "@/i18n";
import { PRIORITIES, type Task, type TaskPatch } from "../schema";

interface Props {
  task: Task;
  fresh?: boolean;
  today: string;
  locale: Locale;
  t: Dictionary;
  onPatch: (id: string, patch: TaskPatch) => void;
  onDelete: (id: string) => void;
  onTag: (tag: string) => void;
}

export function TaskRow({ task, fresh, today, locale, t, onPatch, onDelete, onTag }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  const overdue = !task.done && task.due !== null && dayDiff(task.due, today) < 0;
  const nextPriority = PRIORITIES[(PRIORITIES.indexOf(task.priority) + 1) % PRIORITIES.length];

  function commit() {
    const title = draft.trim();
    setEditing(false);
    if (title && title !== task.title) onPatch(task.id, { title });
    else setDraft(task.title);
  }

  return (
    <li className={`task${task.done ? " is-done" : ""}${fresh ? " is-new" : ""}`} data-priority={task.priority}>
      <button
        type="button"
        className="check"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? t.markOpen : t.markDone}
        onClick={() => onPatch(task.id, { done: !task.done })}
      />

      <div className="task-body">
        {editing ? (
          <input
            className="task-edit"
            value={draft}
            autoFocus
            aria-label={t.editTitle}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
              if (event.key === "Escape") {
                setDraft(task.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="task-title"
            title={t.editTitle}
            onClick={() => {
              setDraft(task.title);
              setEditing(true);
            }}
          >
            {task.title}
          </button>
        )}

        {task.notes && <p className="task-notes">{task.notes}</p>}

        <div className="task-tags">
          {!task.done && (
            <button
              type="button"
              className="chip chip-tag plan-today"
              aria-pressed={task.plannedFor === today}
              disabled={!today}
              onClick={() => onPatch(task.id, { plannedFor: task.plannedFor === today ? null : today })}
            >
              {task.plannedFor === today ? t.removeFromToday : t.addToToday}
            </button>
          )}
          {task.tags.map((tag) => (
            <button type="button" key={tag} className="chip chip-tag" onClick={() => onTag(tag)}>
              #{tag}
            </button>
          ))}
        </div>
      </div>

      <label className={`chip due${overdue ? " is-overdue" : ""}${task.due ? "" : " is-empty"}`}>
        <span>
          {task.due ? dueLabel(task.due, today, locale, t) : t.noDate}
          {overdue && ` · ${t.overdue}`}
        </span>
        <input
          type="date"
          value={task.due ?? ""}
          aria-label={t.setDate}
          onChange={(event) => onPatch(task.id, { due: event.target.value || null })}
        />
      </label>

      <button
        type="button"
        className="chip priority"
        title={`${t.priority}: ${t[task.priority]}`}
        aria-label={`${t.priority}: ${t[task.priority]}`}
        onClick={() => onPatch(task.id, { priority: nextPriority })}
      >
        <span className="priority-mark" aria-hidden />
        {t[task.priority]}
      </button>

      <button type="button" className="remove" aria-label={t.delete} title={t.delete} onClick={() => onDelete(task.id)}>
        ×
      </button>
    </li>
  );
}
