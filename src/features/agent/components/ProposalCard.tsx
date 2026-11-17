"use client";

import { useId, useState } from "react";
import { errorMessage, type Dictionary, type Locale } from "@/i18n";
import { formatTimestamp } from "@/lib/dates";
import type { Project } from "@/features/projects/schema";
import type { Proposal, ProposalDecision } from "../schema";
import { ProposalEditor } from "./ProposalEditor";
import { ProposalValues } from "./ProposalValues";

export function ProposalCard({ proposal, projects, locale, t, busy, saving, error, onDecision }: {
  proposal: Proposal; projects: Project[]; locale: Locale; t: Dictionary; busy: boolean; saving: boolean; error?: string;
  onDecision: (id: string, decision: ProposalDecision) => Promise<void>;
}) {
  const [draft, setDraft] = useState(proposal.action);
  const heading = useId();
  const uncertain = proposal.status === "applying" || error === "agent_uncertain";
  const action = proposal.approved ?? (uncertain ? draft : proposal.action);
  const title = action.kind === "create_task" ? action.task.title : action.kind === "update_task" ? proposal.taskBefore?.title : action.name;
  const values = (shown = action, before = false) => <ProposalValues action={shown} proposal={proposal} projects={projects} locale={locale} t={t} before={before} />;
  return <article className="card proposal" aria-labelledby={heading} data-proposal-id={proposal.id} tabIndex={-1}>
    <header className="proposal-header"><div><p className="eyebrow">{t.agentKinds[action.kind]}</p><h3 id={heading}>{title}</h3></div>
      <span className={`chip${proposal.status === "accepted" ? " chip-success" : ""}`}>{t.agentStatuses[uncertain ? "applying" : proposal.status]}</span>
    </header>
    <p className="proposal-reason">{proposal.reason}</p>
    {proposal.status === "pending" && !uncertain ? <>
      {(action.kind === "update_task" || action.kind === "rename_project") && <section aria-label={t.agentBefore}>
        <h4>{t.agentBefore}</h4>{values(proposal.action, true)}
      </section>}
      <form noValidate onSubmit={(event) => event.preventDefault()}>
        <fieldset className="proposal-editor" disabled={busy}><legend>{t.agentReview}</legend>
          <ProposalEditor action={draft} onChange={setDraft} projects={projects} t={t} />
          <div className="proposal-actions">
            <button className="btn btn-primary" type="button" onClick={() => { void onDecision(proposal.id, { decision: "accept", action: draft }); }}>{saving ? t.agentSaving : t.agentAccept}</button>
            <button className="btn btn-secondary" type="button" onClick={() => { void onDecision(proposal.id, { decision: "reject" }); }}>{t.agentReject}</button>
          </div>
        </fieldset>
      </form>
    </> : <>
      {(proposal.approved || uncertain) && <section aria-label={t.agentApproved}><h4>{t.agentApproved}</h4>{values()}</section>}
      {uncertain && <>
        <p>{t.agentUncertainHint}</p><div className="proposal-actions">
          <button className="btn btn-primary" type="button" disabled={busy} onClick={() => { void onDecision(proposal.id, { decision: "recheck" }); }}>{t.agentRecheck}</button>
          <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => { void onDecision(proposal.id, { decision: "dismiss" }); }}>{t.agentDismiss}</button>
        </div>
      </>}
      <details><summary>{t.agentOriginal}</summary>{values(proposal.action)}</details>
      {proposal.decidedAt && <p className="hint">{formatTimestamp(proposal.decidedAt, locale)}</p>}
    </>}
    {error && <p className="notice is-error" role="alert">{errorMessage(t, error)}</p>}
    <details className="proposal-source"><summary>{t.agentSource}</summary><p>{proposal.source.note}</p>
      <p className="hint">{t.aiProviders[proposal.source.provider]} · {proposal.source.model} · {formatTimestamp(proposal.createdAt, locale)}</p>
    </details>
  </article>;
}
