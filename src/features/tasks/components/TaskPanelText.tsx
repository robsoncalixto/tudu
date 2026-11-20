"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
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

/** Notes are saved a moment after the typing stops; a title or tag list is saved on Enter or on leaving the field. */
const PAUSE_MS = 800;
/** How long the confirmation stays before the panel is quiet again. */
const SAVED_MS = 2500;

export function TaskPanelText({ field, task, t, draft, onDraftChange, onPatch }: Props) {
  const [state, setState] = useState<"saving" | "saved" | "failed" | null>(null);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);
  // What was saved when this edit began, which Escape goes back to.
  const began = useRef<string | null>(null);
  const label = { title: t.agentTaskTitle, notes: t.agentNotes, tags: t.tags }[field];
  const saved = field === "tags" ? formatPanelTags(task.tags) : task[field];
  const text = draft ?? saved;
  const editing = draft !== undefined;
  const read = (value: string) => taskPatchSchema.safeParse({ [field]: field === "tags" ? parsePanelTags(value) : value });
  const valid = read(text).success;
  const restore = () => requestAnimationFrame(() => {
    if (document.activeElement === document.body) (trigger.current ?? document.getElementById(id))?.focus();
  });

  async function save(value: string, leaving: boolean) {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const patch = read(value);
    if (!patch.success) return;
    const done = () => {
      // A draft typed after this save began stays; see updateTaskDraft.
      onDraftChange(undefined);
      if (leaving && field !== "notes") restore();
    };
    if (JSON.stringify(patch.data[field]) === JSON.stringify(task[field])) {
      if (leaving) done();
      return;
    }
    setState("saving");
    const ok = await onPatch(task.id, patch.data);
    setState(ok ? "saved" : "failed");
    if (!ok) return;
    window.setTimeout(() => setState((current) => current === "saved" ? null : current), SAVED_MS);
    done();
  }
  const latest = useRef({ save, text });
  latest.current = { save, text };
  // Closing the panel or moving to another task must not lose notes that were still waiting to be saved.
  useEffect(() => () => { if (timer.current !== undefined) void latest.current.save(latest.current.text, true); }, []);

  function change(value: string) {
    onDraftChange(value);
    setState(null);
    window.clearTimeout(timer.current);
    if (field === "notes") timer.current = window.setTimeout(() => void latest.current.save(latest.current.text, false), PAUSE_MS);
  }

  function openEditor() {
    began.current = saved;
    onDraftChange(saved);
    setState(null);
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  }

  function cancel() {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    onDraftChange(undefined);
    setState(null);
    // Notes may already have been saved since the edit began; Escape still means "as it was".
    if (field === "notes" && began.current !== null && began.current !== saved) void onPatch(task.id, { notes: began.current });
    if (field !== "notes") restore();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.nativeEvent.isComposing) return;
    // Notes saved during this edit can still be taken back, so Escape belongs to the field until it is as it was.
    const changed = editing || (field === "notes" && began.current !== null && began.current !== saved);
    if (event.key === "Escape" && changed) {
      event.preventDefault();
      event.stopPropagation();
      if (state !== "saving") cancel();
    } else if (event.key === "Enter" && field !== "notes" && !event.shiftKey) {
      event.preventDefault();
      (event.target as HTMLElement).blur();
    }
  }

  const status = <div className="inspector-save-state" aria-live="polite">
    {state === "saving" && t.savingSettings}
    {state === "saved" && <><Icon name="check" size={13} />{t.taskResources.saved}</>}
  </div>;

  if (!editing && field === "title") return <div className="inspector-title-line">
    <h2>{task.title}</h2>
    {status}
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

  const fieldProps = {
    className: "form-control", id, value: text, "aria-invalid": !valid || undefined,
    onFocus: () => { if (began.current === null) began.current = saved; },
    onBlur: () => {
      if (valid) void save(text, true);
      else if (field !== "notes") cancel();
      began.current = null;
    },
  };
  return <div className={`inspector-text-editor inspector-${field}`} role="group" aria-label={label} onKeyDown={onKeyDown}>
    <label className="inspector-label" htmlFor={id}><Icon name={field === "notes" ? "note" : field === "tags" ? "tag" : "pencil"} size={17} />{label}</label>
    {field === "title"
      ? <input {...fieldProps} required maxLength={300} onChange={(event) => change(event.target.value)} />
      : <textarea {...fieldProps} rows={field === "notes" ? 3 : 2} maxLength={field === "notes" ? 2000 : undefined}
          placeholder={field === "notes" ? t.writeTaskNotes : undefined} aria-describedby={field === "tags" ? `${id}-hint` : undefined}
          onChange={(event) => change(event.target.value)} />}
    {field === "tags" && <small className="hint" id={`${id}-hint`}>{valid ? t.taskTagsHint : t.taskTagsLimit}</small>}
    {status}
    {state === "failed" && <p role="alert" className="inspector-error">
      <span>{t.errors.generic}</span>
      <button type="button" className="chip" onClick={() => void save(text, false)}>{t.retry}</button>
    </p>}
  </div>;
}
