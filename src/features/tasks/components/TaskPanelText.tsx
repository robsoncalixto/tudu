"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { Dictionary } from "@/i18n";
import { Icon } from "@/lib/Icon";
import { formatPanelTags, parsePanelTags } from "../panel-tags";
import { taskPatchSchema, type Task, type TaskPatch } from "../schema";

interface Props {
  field: "title" | "notes" | "tags";
  task: Task;
  t: Dictionary;
  draft?: string;
  onDraftChange: (draft: string | undefined) => void;
  onPatch: (id: string, changes: TaskPatch) => Promise<boolean>;
}

export function TaskPanelText({ field, task, t, draft, onDraftChange, onPatch }: Props) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const label = { title: t.agentTaskTitle, notes: t.agentNotes, tags: t.tags }[field];
  const saved = field === "tags" ? formatPanelTags(task.tags) : task[field];
  const text = draft ?? saved;
  const editing = draft !== undefined;
  const patch = taskPatchSchema.safeParse({ [field]: field === "tags" ? parsePanelTags(text) : text });
  const restore = () => requestAnimationFrame(() => {
    if (document.activeElement === document.body) (trigger.current ?? document.getElementById(id))?.focus();
  });

  function openEditor() {
    onDraftChange(saved);
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  }

  function cancel() {
    onDraftChange(undefined);
    setFailed(false);
    restore();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && editing && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.stopPropagation();
      if (!busy) cancel();
    }
  }

  if (!editing && field === "title") return <div className="inspector-title-line">
    <h2>{task.title}</h2>
    <button type="button" className="inspector-icon" ref={trigger} aria-label={t.editTitle} title={t.editTitle}
      onClick={openEditor}><Icon name="pencil" size={16} /></button>
  </div>;

  if (!editing && field === "tags") return <button type="button" className="inspector-property inspector-tags-button"
    ref={trigger} aria-label={t.editTaskTags} title={t.editTaskTags} onClick={openEditor}>
    <span className="inspector-label"><Icon name="tag" size={17} />{label}</span>
    <span className="inspector-tags-value">{task.tags.length
      ? task.tags.map((tag, index) => <span className="chip" key={index}>#{tag}</span>) : t.noTags}</span>
    <Icon name="pencil" size={15} />
  </button>;

  return <form className={`inspector-text-editor inspector-${field}`} aria-label={label} onKeyDown={onKeyDown}
    onSubmit={async (event) => {
      event.preventDefault();
      if (!patch.success || busy) return;
      setBusy(true);
      const ok = await onPatch(task.id, patch.data);
      setBusy(false);
      setFailed(!ok);
      if (ok) { onDraftChange(undefined); restore(); }
    }}>
    <label className="inspector-label" htmlFor={id}><Icon name={field === "notes" ? "note" : field === "tags" ? "tag" : "pencil"} size={17} />{label}</label>
    {field === "title"
      ? <input className="form-control" id={id} disabled={busy} value={text} required maxLength={300}
          onChange={(event) => onDraftChange(event.target.value)} />
      : <textarea className="form-control" id={id} disabled={busy} value={text} rows={field === "notes" ? 3 : 2}
          maxLength={field === "notes" ? 2000 : undefined} placeholder={field === "notes" ? t.writeTaskNotes : undefined}
          aria-describedby={field === "tags" ? `${id}-hint` : undefined} aria-invalid={!patch.success}
          onChange={(event) => onDraftChange(event.target.value)} />}
    {field === "tags" && <small className="hint" id={`${id}-hint`}>{patch.success ? t.taskTagsHint : t.taskTagsLimit}</small>}
    {failed && <p role="alert" className="inspector-error">{t.errors.generic}</p>}
    {editing && <div className="inspector-editor-actions">
      <button type="submit" className="btn btn-primary" disabled={!patch.success || busy}>{t.saveTaskField}</button>
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={cancel}>{t.cancel}</button>
    </div>}
  </form>;
}
