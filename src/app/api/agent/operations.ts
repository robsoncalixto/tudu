import { addApprovedTask, readDayOrder, setDayOrder, listTasks, TaskChangedError, updateTaskIfUnchanged } from "@/features/tasks/server/repository";
import { addProject, listProjects, ProjectChangedError, ProjectError, updateProject, withValidProjectIds } from "@/features/projects/server/repository";
import { InvalidRepeatError } from "@/features/tasks/recurrence";
import { AgentError } from "@/features/agent/schema";
import type { ProposalOperations } from "@/features/agent/server/decide";

async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof TaskChangedError || error instanceof ProjectChangedError) throw new AgentError("agent_stale");
    if (error instanceof ProjectError) throw new AgentError(error.code);
    if (error instanceof InvalidRepeatError) throw new AgentError("invalid_repeat");
    throw error;
  }
}
export const proposalOperations: ProposalOperations = {
  listTasks, listProjects, readDayOrder, setDayOrder: (order, expected) => guarded(() => setDayOrder(order, expected)),
  createTask: (id, { plannedFor, ...input }) => guarded(() => withValidProjectIds([input.projectId], () => addApprovedTask(id, input, plannedFor))),
  updateTask: (id, patch, expected) => guarded(() => withValidProjectIds([patch.projectId], () => updateTaskIfUnchanged(id, patch, expected))),
  createProject: (id, name) => guarded(() => addProject({ name }, id)),
  renameProject: (id, name, expectedName) => guarded(() => updateProject(id, { name }, expectedName)),
};
