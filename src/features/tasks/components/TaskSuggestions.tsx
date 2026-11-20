"use client";

import { useRef, useState } from "react";
import { agentApi } from "@/features/agent/api";
import type { Project } from "@/features/projects/schema";
import { errorMessage, type Dictionary, type Locale } from "@/i18n";
import { dueLabel, type DateFormat } from "@/lib/dates";
import { errorCode } from "@/lib/http";
import { suggestedSteps, type ContextProposal, type SuggestedField } from "../task-suggestions";

export function TaskSuggestionField({ field, proposals, projects, today, locale, t, dateFormat }: {
  field: SuggestedField; proposals: ContextProposal[]; projects: Project[];
  today: string; locale: Locale; t: Dictionary; dateFormat: DateFormat;
}) {
  const date = (value?: string | null) => value ? dueLabel(value, today, locale, t, dateFormat) : t.noDate;
  return proposals.map((proposal) => {
    if (proposal.action.kind !== "update_task" || !(field in proposal.action.patch)) return null;
    const { patch } = proposal.action;
    if (field === "steps") {
      const steps = suggestedSteps(proposal);
      return steps.length > 0 && <div className="inspector-suggestion" key={proposal.id}>
        <strong>{t.suggestedSubtasks}</strong>
        <ul>{steps.map((step) => <li key={step.id}>{step.title}</li>)}</ul>
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
      <strong>{t.suggestedValue(values[field] ?? "")}</strong><p>{proposal.reason}</p>
    </div>;
  });
}

export function TaskSuggestionActions({ proposals, t, onApplied }: {
  proposals: ContextProposal[]; t: Dictionary; onApplied: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inFlight = useRef(false);

  async function decide(proposal: ContextProposal, accept: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(proposal.id);
    try {
      setErrors((current) => ({ ...current, [proposal.id]: "" }));
      await agentApi.decide(proposal.id, accept ? { decision: "accept", action: proposal.action } : { decision: "reject" });
      if (accept) onApplied();
    } catch (error) { setErrors((current) => ({ ...current, [proposal.id]: errorCode(error) })); }
    finally { inFlight.current = false; setBusy(null); }
  }

  if (!proposals.length) return null;
  return <section className="inspector-suggestion-decisions" aria-label={t.agentPending}>
    <h3 className="section-title">{t.agentPending}</h3>
    {proposals.map((proposal) => <div key={proposal.id} aria-busy={busy === proposal.id}>
      {proposal.action.kind === "flag_duplicate" && <p>{t.agentPossibleDuplicate(proposal.action.otherTitle)}</p>}
      <p>{proposal.reason}</p>
      <div className="proposal-actions">
        <button type="button" className="btn btn-primary" disabled={busy !== null}
          onClick={() => void decide(proposal, true)}>{busy === proposal.id ? t.agentSaving : t.agentAccept}</button>
        <button type="button" className="btn btn-secondary" disabled={busy !== null}
          onClick={() => void decide(proposal, false)}>{t.agentReject}</button>
      </div>
      {errors[proposal.id] && <p className="notice is-error" role="alert">{errorMessage(t, errors[proposal.id])}</p>}
    </div>)}
  </section>;
}
