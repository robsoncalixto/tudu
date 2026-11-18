"use client";

import { useId, useRef } from "react";
import type { Dictionary } from "@/i18n";
import { Icon } from "@/lib/Icon";
import { MAX_TASK_LINK_LENGTH, MAX_TASK_LINKS, taskLinkSchema } from "../schema";
import { useResourceForm, type ResourceMessage, type ResourceProps } from "../use-resource-form";
import "./task-resources.css";

export function ResourceFeedback({ id, message, t }: { id: string; message: ResourceMessage | null; t: Dictionary }) {
  if (!message) return null;
  return <p id={id} role="status" className={`resource-feedback${message !== "saved" ? " is-error" : ""}`}>
    {t.taskResources[message]}
  </p>;
}

export function TaskLinks(props: ResourceProps<string>) {
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
    <ResourceFeedback id={`${id}-feedback`} message={form.message} t={t} />
  </section>;
}
