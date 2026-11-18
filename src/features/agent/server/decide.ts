import { taskInputSchema, taskSchema, type Task, type TaskPatch } from "@/features/tasks/schema";
import type { Project } from "@/features/projects/schema";
import { AgentError, proposalActionSchema, type Proposal, type ProposalAction, type ProposalDecision, type ProposalResult } from "../schema";
import type { ProposalRepository } from "./repository";

export interface ProposalOperations {
  listTasks(): Promise<Task[]>;
  listProjects(): Promise<Project[]>;
  createTask(id: string, input: Extract<ProposalAction, { kind: "create_task" }>["task"]): Promise<Task>;
  updateTask(id: string, patch: TaskPatch, expected: Task): Promise<Task | null>;
  createProject(id: string, name: string): Promise<Project>;
  renameProject(id: string, name: string, expectedName: string): Promise<Project | null>;
}
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
function editedAction(proposal: Proposal, edited: ProposalAction): ProposalAction {
  const action = proposalActionSchema.parse(edited);
  const original = proposal.action;
  if (action.kind !== original.kind
    || action.kind === "update_task" && (original.kind !== "update_task" || action.taskId !== original.taskId
      || !same(Object.keys(action.patch).sort(), Object.keys(original.patch).sort()))
    || action.kind === "rename_project" && (original.kind !== "rename_project" || action.projectId !== original.projectId)) {
    throw new AgentError("agent_invalid_proposal");
  }
  return action;
}
function matches(proposal: Proposal, action: ProposalAction, result: ProposalResult): boolean {
  if (action.kind === "create_task" && result.kind === "task") {
    const { plannedFor, ...input } = action.task;
    return result.task.id === proposal.id && !result.task.done && result.task.completedAt === null
      && result.task.estimateHours === null && result.task.realTimeHours === null && result.task.links.length === 0
      && result.task.plannedFor === plannedFor && same(taskInputSchema.parse(result.task), input);
  }
  if (action.kind === "update_task" && result.kind === "task" && proposal.taskBefore) {
    return same(taskSchema.parse(result.task), taskSchema.parse({ ...proposal.taskBefore, ...action.patch }));
  }
  return result.kind === "project" && (action.kind === "create_project" || action.kind === "rename_project")
    && result.project.id === (action.kind === "create_project" ? proposal.id : action.projectId) && result.project.name === action.name;
}
async function execute(proposal: Proposal, action: ProposalAction, operations: ProposalOperations): Promise<ProposalResult> {
  if (action.kind === "create_task") return { kind: "task", task: await operations.createTask(proposal.id, action.task) };
  if (action.kind === "create_project") return { kind: "project", project: await operations.createProject(proposal.id, action.name) };
  if (action.kind === "update_task" && proposal.taskBefore) {
    const task = await operations.updateTask(action.taskId, action.patch, proposal.taskBefore);
    if (task) return { kind: "task", task };
  }
  if (action.kind === "rename_project" && proposal.projectBefore) {
    const project = await operations.renameProject(action.projectId, action.name, proposal.projectBefore.name);
    if (project) return { kind: "project", project };
  }
  throw new AgentError("agent_stale");
}
async function outcome(proposal: Proposal, action: ProposalAction, operations: ProposalOperations): Promise<ProposalResult | null> {
  if (action.kind === "create_task" || action.kind === "update_task") {
    const task = (await operations.listTasks()).find((task) => task.id === (action.kind === "create_task" ? proposal.id : action.taskId));
    return task ? { kind: "task", task } : null;
  }
  const project = (await operations.listProjects()).find((project) => project.id === (action.kind === "create_project" ? proposal.id : action.projectId));
  return project ? { kind: "project", project } : null;
}

export function decideProposal(repository: ProposalRepository, id: string, decision: ProposalDecision, operations: ProposalOperations): Promise<Proposal> {
  return repository.change(id, async (proposal, save) => {
    if (proposal.status === "accepted" && decision.decision === "recheck") return proposal;
    if (proposal.status === "unconfirmed" && decision.decision === "dismiss") return proposal;
    if (proposal.status === "accepted" && decision.decision === "accept" && same(proposal.approved, editedAction(proposal, decision.action))) return proposal;
    if (proposal.status === "rejected" && decision.decision === "reject") return proposal;
    if (proposal.status === "applying") {
      if (decision.decision === "dismiss") return save({ ...proposal, status: "unconfirmed", decidedAt: new Date().toISOString() });
      if (decision.decision !== "recheck" || !proposal.approved) throw new AgentError("agent_uncertain");
      const result = await outcome(proposal, proposal.approved, operations);
      if (!result || !matches(proposal, proposal.approved, result)) throw new AgentError("agent_uncertain");
      return save({ ...proposal, status: "accepted", result, appliedAt: new Date().toISOString() });
    }
    if (proposal.status !== "pending") throw new AgentError("agent_decided");
    if (decision.decision === "reject") return save({ ...proposal, status: "rejected", decidedAt: new Date().toISOString() });
    if (decision.decision !== "accept") throw new AgentError("agent_invalid_proposal");
    const approved = editedAction(proposal, decision.action);
    const applying = await save({ ...proposal, status: "applying", approved, decidedAt: new Date().toISOString() });
    try {
      const result = await execute(applying, approved, operations);
      if (!matches(applying, approved, result)) throw new AgentError("agent_uncertain");
      return await save({ ...applying, status: "accepted", result, appliedAt: new Date().toISOString() });
    } catch (error) {
      if (error instanceof AgentError && ["agent_stale", "invalid_project", "duplicate_project", "invalid_repeat", "not_found"].includes(error.code)) {
        await save(proposal);
        throw error;
      }
      // A write may have committed even when its response was lost. Recheck only reads.
      throw new AgentError("agent_uncertain");
    }
  });
}
