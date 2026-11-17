import type { Proposal } from "./schema";

export function splitProposals(proposals: Proposal[]) {
  const newest = [...proposals].reverse().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    pending: newest.filter((proposal) => proposal.status === "pending" || proposal.status === "applying"),
    history: newest.filter((proposal) => proposal.status !== "pending" && proposal.status !== "applying")
      .sort((a, b) => (b.appliedAt ?? b.decidedAt ?? b.createdAt).localeCompare(a.appliedAt ?? a.decidedAt ?? a.createdAt)),
  };
}
