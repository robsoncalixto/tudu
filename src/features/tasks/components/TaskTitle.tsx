"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Project } from "@/features/projects/schema";
import { quickAddApi } from "@/features/quick-add/api";
import type { Dictionary, Locale } from "@/i18n";
import type { Task, TaskPatch } from "../schema";
import { CommandField } from "./CommandField";

interface Props {
  task: Task;
  row: RefObject<HTMLLIElement | null>;
  today: string;
  locale: Locale;
  t: Dictionary;
  projects: Project[];
  savedTags: string[];
  onPatch: (id: string, patch: TaskPatch) => Promise<boolean>;
}

/** A task's title, edited in place. Tokens typed during the edit set the task's fields, as in the new task field. */
export function TaskTitle({ task, row, today, locale, t, projects, savedTags, onPatch }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const button = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const fromRow = useRef(false);
  const discarded = useRef(false);

  useLayoutEffect(() => {
    if (!editing) return;
    field.current?.focus();
    field.current?.setSelectionRange(field.current.value.length, field.current.value.length);
  }, [editing]);

  function finish(save: boolean) {
    if (!editing) return;
    setEditing(false);
    // Keys that started the edit from the row find the row again; a click returns to the title.
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) (fromRow.current ? row.current : button.current)?.focus();
    });
    const { title, changes } = quickAddApi.edit(task.title, draft, today, projects);
    // Only tokens and no title: nothing is saved rather than guessing what was meant.
    if (!save || !title) return;
    const tags = changes.tags && [...new Set([...task.tags, ...changes.tags])];
    const patch: TaskPatch = { ...changes, ...(tags ? { tags } : {}), ...(title === task.title ? {} : { title }) };
    if (Object.keys(patch).length) void onPatch(task.id, patch);
  }

  if (!editing) return <button type="button" className="task-title" ref={button} title={t.editTitle}
    onClick={() => {
      fromRow.current = document.activeElement === row.current;
      discarded.current = false;
      setDraft(task.title);
      setEditing(true);
    }}>{task.title}</button>;

  return <div className="task-edit">
    <CommandField inputRef={field} value={draft} onChange={setDraft} label={t.editTitle} t={t} locale={locale}
      sources={{ today, language: locale, tags: savedTags, projects }} usedTags={task.tags}
      onBlur={() => finish(!discarded.current)}
      onKey={(event, shortcuts) => {
        if (shortcuts.includes("submitTask") || shortcuts.includes("newTaskLine")) { event.preventDefault(); field.current?.blur(); }
        else if (shortcuts.includes("leaveComposer")) { event.preventDefault(); discarded.current = true; finish(false); }
      }} />
  </div>;
}
