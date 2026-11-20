"use client";

import { useRef, useState } from "react";
import { agentApi } from "@/features/agent/api";
import type { Project } from "@/features/projects/schema";
import { errorMessage, type Dictionary, type Locale } from "@/i18n";
import { dueLabel, type DateFormat } from "@/lib/dates";
import { errorCode } from "@/lib/http";
import { suggestedChecklist, type ContextProposal, type SuggestedField } from "../task-suggestions";

export function TaskSuggestionField({ field, proposals, projects, today, locale, t, dateFormat }: {
  field: SuggestedField; proposals: ContextProposal[]; projects: Project[];
  today: string; locale: Locale; t: Dictionary; dateFormat: DateFormat;
}) {
  const date = (value?: string | null) => value ? dueLabel(value, today, locale, t, dateFormat) : t.noDate;
  return proposals.map((proposal) => {
    if (proposal.action.kind !== "update_task" || !(field in proposal.action.patch)) return null;
    const { patch } = proposal.action;
    if (field === "steps") {
      const checklist = suggestedChecklist(proposal);
      if (!checklist) return null;
      return <div className="inspector-suggestion" key={proposal.id}>
        <strong>{checklist.replaced ? t.suggestedChecklist : t.suggestedSubtasks}</strong>
        {checklist.steps.length ? <ol>{checklist.steps.map((step) =>
          <li key={step.id}>{step.title} {checklist.replaced && <span>· {step.done ? t.agentStepStatuses.done : t.agentStepStatuses.open}</span>}</li>
        )}</ol> : <p>{t.agentEmpty}</p>}
        <p>{proposal.reason}</p>
      </div>;
    }
    const values = {
      priority: patch.priority ? t[patch.priority] : "",
      due: date(patch.due), plannedFor: date(patch.plannedFor),
      partOfDay: patch.partOfDay ? t.partsOfDay[patch.partOfDay] : t.anyPartOfDay,
      projectId: patch.projectId ? projects.find(({ id }) => id === patch.projectId)?.name ?? t.agentMissingProject : t.noProject,
      title: patch.title, notes: patch.notes, tags: patch.tags?.join(", "),
    };
    return <div className="inspector-suggestion" key={proposal.id}>
      <strong>{t.suggestedValue(values[field] || t.agentEmpty)}</strong><p>{proposal.reason}</p>
    </div>;
  });
}

export function TaskSuggestionActions({ proposals, t, onApplied }: {
  proposals: ContextProposal[]; t: Dictionary; onApplied: () => void;
}) {
  const [busy, setBusy] = useState<{ id: string; accepting: boolean } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inFlight = useRef(false);

  async function decide(proposal: ContextProposal, accept: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy({ id: proposal.id, accepting: accept });
    try {
      setErrors((current) => ({ ...current, [proposal.id]: "" }));
      await agentApi.decide(proposal.id, accept ? { decision: "accept", action: proposal.action } : { decision: "reject" });
      if (accept) onApplied();
    } catch (error) { setErrors((current) => ({ ...current, [proposal.id]: errorCode(error) })); }
    finally { inFlight.current = false; setBusy(null); }
  }

  const fields: Record<SuggestedField, string> = {
    title: t.agentTaskTitle, notes: t.agentNotes, priority: t.priority, due: t.setDate, tags: t.tags,
    steps: t.suggestedChecklist, projectId: t.project, plannedFor: t.agentPlannedFor,
  };
  if (!proposals.length) return null;
  return <section className="inspector-suggestion-decisions" aria-label={t.agentPending}>
    <h3 className="section-title">{t.agentPending}</h3>
    {proposals.map((proposal) => {
      const action = proposal.action;
      const changes = action.kind === "flag_duplicate" ? t.agentPossibleDuplicate(action.otherTitle)
        : (Object.keys(action.patch) as SuggestedField[]).map((field) => fields[field]).join(", ");
      const label = `proposal-${proposal.id}`;
      return <article key={proposal.id} aria-labelledby={label} aria-busy={busy?.id === proposal.id}>
        <strong id={label}>{changes}</strong>
        <p id={`${label}-reason`}>{proposal.reason}</p>
        <div className="proposal-actions">
          <button type="button" className="btn btn-primary" disabled={busy !== null} aria-describedby={`${label} ${label}-reason`}
            onClick={() => void decide(proposal, true)}>{busy?.id === proposal.id && busy.accepting ? t.agentSaving : t.agentAccept}</button>
          <button type="button" className="btn btn-secondary" disabled={busy !== null} aria-describedby={`${label} ${label}-reason`}
            onClick={() => void decide(proposal, false)}>{busy?.id === proposal.id && !busy.accepting ? t.agentSaving : t.agentReject}</button>
        </div>
        {errors[proposal.id] && <p className="notice is-error" role="alert">{errorMessage(t, errors[proposal.id])}</p>}
      </article>;
    })}
  </section>;
}
