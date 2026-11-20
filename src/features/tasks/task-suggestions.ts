import type { Proposal, ProposalAction } from "@/features/agent/schema";

export type ContextProposal = Proposal & { action: Extract<ProposalAction, { kind: "update_task" | "flag_duplicate" }> };
export type SuggestedField = keyof Extract<ContextProposal["action"], { kind: "update_task" }>["patch"];

export function suggestionsByTask(proposals: Proposal[], enabled: boolean): Map<string, ContextProposal[]> {
  const index = new Map<string, ContextProposal[]>();
  if (!enabled) return index;
  for (const proposal of proposals) {
    if (proposal.status !== "pending" || (proposal.action.kind !== "update_task" && proposal.action.kind !== "flag_duplicate")) continue;
    const { action } = proposal;
    const existing = index.get(action.taskId) ?? [];
    existing.push({ ...proposal, action });
    index.set(action.taskId, existing);
  }
  return index;
}

export function suggestedChecklist(proposal: ContextProposal) {
  if (proposal.action.kind !== "update_task" || !proposal.action.patch.steps) return null;
  const previous = proposal.taskBefore?.steps ?? [];
  const steps = proposal.action.patch.steps;
  const replaced = previous.length > steps.length || previous.some((step, index) => {
    const next = steps[index];
    return !next || step.id !== next.id || step.title !== next.title || step.done !== next.done;
  });
  return { replaced, steps: replaced ? steps : steps.slice(previous.length) };
}
