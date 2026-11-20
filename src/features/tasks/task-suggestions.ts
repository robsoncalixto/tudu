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

export function suggestedSteps(proposal: ContextProposal) {
  if (proposal.action.kind !== "update_task") return [];
  const before = new Set(proposal.taskBefore?.steps.map((step) => step.id));
  return proposal.action.patch.steps?.filter((step) => !before.has(step.id)) ?? [];
}
