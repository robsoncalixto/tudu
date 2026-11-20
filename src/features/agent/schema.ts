import { z } from "zod";
import { taskInputSchema, taskPatchSchema, storedTaskSchema } from "@/features/tasks/schema";
import { projectInputSchema, projectSchema } from "@/features/projects/schema";
import { aiProviderSchema } from "@/features/ai/schema";

const day = z.iso.date().nullable();
export const proposedTaskSchema = taskInputSchema.extend({ due: day, repeat: z.null(), plannedFor: day }).strict();
export const proposedPatchSchema = taskPatchSchema.pick({
  title: true, notes: true, priority: true, due: true, tags: true, steps: true, projectId: true, plannedFor: true,
}).extend({ due: day.optional() }).strict().refine((patch) => Object.keys(patch).length > 0);
export const proposalActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("create_task"), task: proposedTaskSchema }).strict(),
  z.object({ kind: z.literal("update_task"), taskId: z.string().min(1).max(100), patch: proposedPatchSchema }).strict(),
  z.object({ kind: z.literal("flag_duplicate"), taskId: z.string().min(1).max(100), otherTaskId: z.string().min(1).max(100),
    otherTitle: taskInputSchema.shape.title }).strict().refine((action) => action.taskId !== action.otherTaskId),
  z.object({ kind: z.literal("create_project"), name: projectInputSchema.shape.name }).strict(),
  z.object({ kind: z.literal("rename_project"), projectId: z.uuid(), name: projectInputSchema.shape.name }).strict(),
]);
export type ProposalAction = z.infer<typeof proposalActionSchema>;
export const proposalDraftSchema = z.object({
  action: proposalActionSchema, reason: z.string().trim().min(1).max(21_000),
  taskBefore: storedTaskSchema.nullable(), projectBefore: projectSchema.nullable(),
});
export type ProposalDraft = z.infer<typeof proposalDraftSchema>;
export const proposalSourceSchema = z.object({
  note: z.string().trim().max(8000), review: z.literal(true).optional(), today: z.iso.date(), provider: aiProviderSchema, model: z.string().min(1).max(160),
}).refine((source) => source.review || source.note.length > 0);
export type ProposalSource = z.infer<typeof proposalSourceSchema>;
const resultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("task"), task: storedTaskSchema }),
  z.object({ kind: z.literal("project"), project: projectSchema }),
]);
export type ProposalResult = z.infer<typeof resultSchema>;
export const proposalSchema = proposalDraftSchema.extend({
  id: z.uuid(), createdAt: z.iso.datetime(), source: proposalSourceSchema,
  status: z.enum(["pending", "applying", "accepted", "rejected", "unconfirmed"]),
  approved: proposalActionSchema.nullable(), result: resultSchema.nullable(),
  decidedAt: z.iso.datetime().nullable(), appliedAt: z.iso.datetime().nullable(),
}).superRefine((proposal, context) => {
  const decided = proposal.status !== "pending";
  const approved = ["applying", "accepted", "unconfirmed"].includes(proposal.status);
  if (decided !== Boolean(proposal.decidedAt) || approved !== Boolean(proposal.approved)
    || (proposal.status === "accepted" ? !proposal.result || !proposal.appliedAt : proposal.result !== null || proposal.appliedAt !== null)
    || (proposal.action.kind === "update_task" || proposal.action.kind === "flag_duplicate" ? proposal.taskBefore?.id !== proposal.action.taskId : proposal.taskBefore !== null)
    || (proposal.action.kind === "rename_project" ? proposal.projectBefore?.id !== proposal.action.projectId : proposal.projectBefore !== null)) {
    context.addIssue({ code: "custom", message: "Invalid proposal decision state" });
  }
});
export type Proposal = z.infer<typeof proposalSchema>;
export const automaticReviewStatusSchema = z.object({
  ranAt: z.iso.datetime(), outcome: z.enum(["running", "succeeded", "failed"]), summary: z.string().optional(),
});
export const agentStateSchema = z.object({
  automaticReview: automaticReviewStatusSchema.nullable().optional(),
  proposals: z.array(proposalSchema), projects: z.array(projectSchema), enabled: z.boolean(),
});
export type AgentState = z.infer<typeof agentStateSchema>;
export const proposalRequestSchema = z.object({
  text: z.string().trim().max(8000), today: z.iso.date(), review: z.literal(true).optional(),
}).strict().refine((input) => input.review || input.text.length > 0);
export const taskReviewResponseSchema = z.object({ summary: z.string(), proposals: z.array(proposalSchema) });
export const proposalDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("accept"), action: proposalActionSchema }).strict(),
  z.object({ decision: z.literal("reject") }).strict(),
  z.object({ decision: z.literal("recheck") }).strict(),
  z.object({ decision: z.literal("dismiss") }).strict(),
]);
export type ProposalDecision = z.infer<typeof proposalDecisionSchema>;
const agentErrorCodeSchema = z.enum([
  "agent_invalid_proposal", "agent_context_too_large", "agent_failed", "agent_stale", "agent_decided", "agent_uncertain",
  "not_found", "invalid_project", "duplicate_project", "invalid_repeat",
]);
export class AgentError extends Error {
  constructor(public readonly code: z.infer<typeof agentErrorCodeSchema>) { super(code); }
}
