"use client";

import { useId, useRef, useState } from "react";
import type { Dictionary } from "@/i18n";
import { Icon } from "@/lib/Icon";
import { estimateMinutesSchema, MAX_ESTIMATE_MINUTES, MAX_TASK_LINK_LENGTH, MAX_TASK_LINKS, taskLinkSchema, type Task, type TaskPatch } from "../schema";
import "./task-resources.css";

interface Props {
  task: Task;
  t: Dictionary;
  onPatch: (id: string, changes: TaskPatch) => Promise<boolean>;
  draft?: string;
  onDraftChange?: (draft: string | undefined) => void;
}

type Message = "saved" | "saveFailed" | "invalidUrl" | "duplicateLink" | "linkLimit" | "linkTooLong" | "invalidEstimate";

function useResourceForm({ task, onPatch, draft, onDraftChange }: Props) {
  const [localDraft, setLocalDraft] = useState<string>();
  const [message, setMessage] = useState<Message | null>(null);
  const [saving, setSaving] = useState(false);
  const edit = onDraftChange ?? setLocalDraft;
  async function save(patch: TaskPatch) {
    setMessage(null);
    setSaving(true);
    try {
      const ok = await onPatch(task.id, patch);
      setMessage(ok ? "saved" : "saveFailed");
      return ok;
    } catch {
      setMessage("saveFailed");
      return false;
    } finally {
      setSaving(false);
    }
  }
  return { draft: onDraftChange ? draft : localDraft, edit, save, saving, message, setMessage };
}

function Feedback({ id, message, t }: { id: string; message: Message | null; t: Dictionary }) {
  if (!message) return null;
  return <p id={id} role="status" className={`resource-feedback${message !== "saved" ? " is-error" : ""}`}>
    {t.taskResources[message]}
  </p>;
}

export function TaskEstimate(props: Props) {
  const { task, t } = props;
  const form = useResourceForm(props);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const saved = task.estimateMinutes?.toString() ?? "";
  const value = form.draft ?? saved;
  return <form className="task-estimate" aria-label={t.taskResources.estimate} noValidate onSubmit={async (event) => {
    event.preventDefault();
    if (form.saving) return;
    const minutes = estimateMinutesSchema.safeParse(value === "" ? null : Number(value));
    if (input.current?.validity.badInput || !minutes.success) {
      form.setMessage("invalidEstimate");
      return;
    }
    if (await form.save({ estimateMinutes: minutes.data })) form.edit(undefined);
    if (document.activeElement === document.body) input.current?.focus();
  }}>
    <div className="inspector-property">
      <label htmlFor={id} className="inspector-label"><Icon name="clock" size={17} />{t.taskResources.estimate}</label>
      <div className="resource-input-row">
        <input ref={input} id={id} className="form-control estimate-input" type="number" inputMode="numeric"
          min="1" max={MAX_ESTIMATE_MINUTES} step="1" value={value} readOnly={form.saving}
          aria-describedby={form.message ? `${id}-feedback` : undefined} aria-invalid={form.message === "invalidEstimate" || undefined} onChange={(event) => {
            form.edit(event.target.value); form.setMessage(null);
          }} />
        {(form.draft !== undefined || form.saving) && <button type="submit" className="icon-btn resource-confirm"
          disabled={form.saving} aria-label={t.taskResources.saveEstimate} title={t.taskResources.saveEstimate}>
          <Icon name="check" size={17} />
        </button>}
      </div>
    </div>
    <Feedback id={`${id}-feedback`} message={form.message} t={t} />
  </form>;
}

export function TaskLinks(props: Props) {
  const { task, t } = props;
  const form = useResourceForm(props);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const value = form.draft ?? "";
  const full = task.links.length >= MAX_TASK_LINKS;
  return <section className="inspector-section task-resources" aria-labelledby={id}>
    <h3 id={id}><Icon name="link" size={17} />{t.taskResources.links}</h3>
    {task.links.length > 0 && <ul className="resource-links">
      {task.links.map((url) => <li key={url}>
        <a href={url} title={url} target="_blank" rel="noopener noreferrer">{url}</a>
        <button type="button" className="icon-btn" disabled={form.saving} aria-label={t.taskResources.removeLink(url)}
          title={t.taskResources.removeLink(url)} onClick={async () => {
            if (await form.save({ links: task.links.filter((item) => item !== url) }) && document.activeElement === document.body) input.current?.focus();
          }}><Icon name="x" size={16} /></button>
      </li>)}
    </ul>}
    <form noValidate onSubmit={async (event) => {
      event.preventDefault();
      if (form.saving) return;
      if (value.trim().length > MAX_TASK_LINK_LENGTH) { form.setMessage("linkTooLong"); return; }
      const parsed = taskLinkSchema.safeParse(value);
      if (!parsed.success) { form.setMessage("invalidUrl"); return; }
      if (task.links.includes(parsed.data)) { form.setMessage("duplicateLink"); return; }
      if (full) { form.setMessage("linkLimit"); return; }
      if (await form.save({ links: [...task.links, parsed.data] })) form.edit(undefined);
      if (document.activeElement === document.body) input.current?.focus();
    }}>
      <label htmlFor={`${id}-url`}>{t.taskResources.url}</label>
      <div className="resource-input-row">
        <input id={`${id}-url`} ref={input} className="form-control" type="url" inputMode="url"
          autoComplete="url" spellCheck={false} value={value}
          readOnly={form.saving || full} aria-describedby={form.message ? `${id}-hint ${id}-feedback` : `${id}-hint`}
          aria-invalid={form.message === "invalidUrl" || form.message === "duplicateLink" || form.message === "linkTooLong" || undefined}
          onChange={(event) => { form.edit(event.target.value); form.setMessage(null); }} />
        <button className="icon-btn resource-confirm" type="submit" title={t.taskResources.addLink} aria-label={t.taskResources.addLink}
          disabled={form.saving || full || !value.trim()}><Icon name="plus" size={17} /></button>
      </div>
      <p className="hint" id={`${id}-hint`}>{full ? t.taskResources.linkLimit : t.taskResources.linkHint}</p>
    </form>
    <Feedback id={`${id}-feedback`} message={form.message} t={t} />
  </section>;
}
