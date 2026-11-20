"use client";

import { useRef, useState } from "react";
import { errorMessage } from "@/i18n";
import { useLocale } from "@/i18n/use-locale";
import { Icon } from "@/lib/Icon";
import { formatTimestamp } from "@/lib/dates";
import { useToday } from "@/lib/use-today";
import type { Settings } from "@/features/settings/schema";
import { useAgent } from "../use-agent";
import { splitProposals } from "../selectors";
import type { Proposal, ProposalDecision } from "../schema";
import { ProposalCard } from "./ProposalCard";

export function AgentPanel({ settings }: { settings: Settings }) {
  const { locale, t } = useLocale(settings.locale);
  const today = useToday();
  const agent = useAgent();
  const root = useRef<HTMLElement>(null);
  const [historyLimit, setHistoryLimit] = useState(10);
  const automatic = agent.state?.automaticReview;
  const automaticOutcome = automatic?.skipReason
    ? `${t.automaticReviewOutcomes.skipped} · ${t.automaticReviewSkipReasons[automatic.skipReason]}`
    : automatic && t.automaticReviewOutcomes[automatic.outcome];
  const { pending, history } = splitProposals(agent.state?.proposals ?? []);
  const busy = agent.generating || agent.busyId !== null;
  async function decide(id: string, decision: ProposalDecision) {
    if (await agent.decide(id, decision)) requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-proposal-id="${id}"]`)?.focus());
  }
  const cards = (proposals: Proposal[]) => proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal}
    projects={agent.state?.projects ?? []} locale={locale} t={t} busy={busy} saving={agent.busyId === proposal.id} error={agent.errors[proposal.id]} onDecision={decide} />);
  return <main className="page-content agent-page" ref={root} aria-busy={busy}>
    <header className="page-header">
      <a className="back-link" href="/"><Icon name="arrow-left" />{t.backToTasks}</a>
      <div className="agent-header-tools">
        <a className="btn btn-secondary" href="/settings?from=agent" aria-label={t.settings} title={t.settings}>
          <Icon name="settings" /><span>{t.settings}</span>
        </a>
        <span className="brand-name">TUDU</span>
      </div>
    </header>
    <h1>{t.agent}</h1><p className="agent-intro">{t.agentIntro}</p>
    <form className="card agent-request" onSubmit={(event) => { event.preventDefault(); if (today) void agent.propose(today); }}>
      <label htmlFor="agent-note">{t.agentPrompt}</label>
      <textarea className="form-control" id="agent-note" value={agent.text} maxLength={8000} rows={4} placeholder={t.agentPromptHint}
        disabled={busy} onChange={(event) => agent.setText(event.target.value)} />
      <div className="proposal-actions">
        <button type="button" className="btn btn-primary" disabled={!agent.state?.enabled || !today || busy}
          aria-describedby={!agent.state?.enabled ? "agent-ai-hint" : undefined} onClick={() => { if (today) void agent.propose(today, true); }}>
          {t.agentReviewTasks}
        </button><button type="submit" className="btn btn-secondary" disabled={!agent.state?.enabled || !today || !agent.text.trim() || busy} aria-describedby={!agent.state?.enabled ? "agent-ai-hint" : undefined}>
        {agent.generating ? t.agentProposing : t.agentPropose}
      </button><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { void agent.reload(); }}>{t.agentRefresh}</button></div>
      {agent.state && !agent.state.enabled && <p className="hint" id="agent-ai-hint">{t.aiOff}</p>}
    </form>
    <p className={`notice${agent.error ? " is-error" : ""}`} role="status">{agent.error ? errorMessage(t, agent.error) : agent.loading ? t.loading : agent.empty ? t.agentNoSuggestions : ""}</p>
    {automatic && automaticOutcome && <p className="hint">
      {t.automaticReviewLast(formatTimestamp(automatic.ranAt, locale), automaticOutcome)}
    </p>}
    {(agent.summary ?? agent.state?.automaticReview?.summary) && <section className="card work-log-summary" aria-labelledby="agent-review-summary">
      <h2 className="section-title" id="agent-review-summary">{t.agentReviewSummary}</h2>
      <p>{agent.summary ?? agent.state?.automaticReview?.summary}</p>
    </section>}
    {agent.state && <>
      <section aria-labelledby="agent-pending"><h2 className="section-title" id="agent-pending">{t.agentPending} <span>{pending.length}</span></h2>
        {pending.length ? cards(pending) : <p className="card empty">{t.agentNoPending}</p>}
      </section>
      <section aria-labelledby="agent-history"><h2 className="section-title" id="agent-history">{t.agentHistory} <span>{history.length}</span></h2>
        {history.length ? cards(history.slice(0, historyLimit)) : <p>{t.agentNoHistory}</p>}
        {history.length > historyLimit && <button className="btn btn-secondary" onClick={() => setHistoryLimit((current) => current + 10)}>{t.agentShowMore}</button>}
      </section>
    </>}
  </main>;
}
