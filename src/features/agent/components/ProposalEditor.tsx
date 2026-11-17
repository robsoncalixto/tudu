"use client";

import { useId, useState } from "react";
import type { Dictionary } from "@/i18n";
import { PRIORITIES } from "@/features/tasks/schema";
import type { Project } from "@/features/projects/schema";
import type { ProposalAction } from "../schema";

interface Props { action: ProposalAction; projects: Project[]; t: Dictionary; onChange: (action: ProposalAction) => void }
export function ProposalEditor({ action, projects, t, onChange }: Props) {
  if (action.kind === "create_project" || action.kind === "rename_project") return <label>{t.projectName}
    <input value={action.name} maxLength={80} onChange={(event) => onChange({ ...action, name: event.target.value })} />
  </label>;
  const values = action.kind === "create_task" ? action.task : action.patch;
  const change = (fields: Extract<ProposalAction, { kind: "update_task" }>["patch"]) => onChange(action.kind === "create_task"
    ? { ...action, task: { ...action.task, ...fields } } : { ...action, patch: { ...action.patch, ...fields } });
  return <>
    {"title" in values && <label>{t.agentTaskTitle}<input maxLength={300} value={values.title ?? ""} onChange={(event) => change({ title: event.target.value })} /></label>}
    {"notes" in values && <label>{t.agentNotes}<textarea maxLength={2000} value={values.notes ?? ""} onChange={(event) => change({ notes: event.target.value })} /></label>}
    {"priority" in values && <label>{t.priority}<select value={values.priority} onChange={(event) => change({ priority: event.target.value as typeof values.priority })}>
      {PRIORITIES.map((priority) => <option key={priority} value={priority}>{t[priority]}</option>)}
    </select></label>}
    {"due" in values && <label>{t.setDate}<input type="date" value={values.due ?? ""} onChange={(event) => change({ due: event.target.value || null })} /></label>}
    {"plannedFor" in values && <label>{t.agentPlannedFor}<input type="date" value={values.plannedFor ?? ""} onChange={(event) => change({ plannedFor: event.target.value || null })} /></label>}
    {"projectId" in values && <label>{t.project}<select value={values.projectId ?? ""} onChange={(event) => change({ projectId: event.target.value || null })}>
      <option value="">{t.noProject}</option>
      {values.projectId && !projects.some((project) => project.id === values.projectId) && <option value={values.projectId}>{t.agentMissingProject}</option>}
      {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
    </select></label>}
    {"tags" in values && <ProposalTags initial={values.tags ?? []} t={t} onChange={(tags) => change({ tags })} />}
    {"steps" in values && <fieldset className="proposal-steps"><legend>{t.checklist}</legend>
      {values.steps?.map((step, index) => <div className="proposal-step" key={step.id}>
        <label>{t.agentStep(index + 1)}{step.done && <small>{t.agentStepStatuses.done}</small>}
          <input maxLength={300} value={step.title} onChange={(event) => change({ steps: values.steps?.map((current, i) => i === index ? { ...current, title: event.target.value } : current) })} />
        </label>
        <button type="button" className="btn btn-secondary" aria-label={t.deleteStep(step.title)} onClick={() => change({ steps: values.steps?.filter((_, i) => i !== index) })}>×</button>
      </div>)}
      <button type="button" className="btn btn-secondary" disabled={(values.steps?.length ?? 0) >= 100}
        onClick={() => change({ steps: [...values.steps ?? [], { id: `review-${Date.now()}-${values.steps?.length ?? 0}`, title: "", done: false }] })}>{t.addStep}</button>
    </fieldset>}
  </>;
}

function ProposalTags({ initial, t, onChange }: { initial: string[]; t: Dictionary; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState(initial.join(", "));
  const hint = useId();
  return <div><label>{t.tags}<input value={text} aria-describedby={hint} onChange={(event) => {
    setText(event.target.value); onChange(event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean));
  }} /></label><small id={hint}>{t.agentTagsHint}</small></div>;
}
