import { ZodError } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { Task, TaskDraft, TaskPatch, TaskUpdate } from "@/features/tasks/schema";
import type { Project } from "@/features/projects/schema";
import { addTasksToolSchema, completeTaskToolSchema, deleteTaskToolSchema, listTasksToolSchema, listProjectsToolSchema, updateTaskToolSchema } from "../schema";
import { filterTasks } from "../selectors";

export interface TaskOperations {
  listTasks(): Promise<Task[]>;
  listProjects(): Promise<Project[]>;
  addTasks(inputs: TaskDraft[]): Promise<Task[]>;
  updateTask(id: string, patch: TaskPatch): Promise<TaskUpdate | null>;
  deleteTask(id: string): Promise<boolean>;
}
export class McpToolError extends Error {
  constructor(public readonly code: "not_found" | "invalid_project" | "invalid_repeat") { super(code); }
}

async function result(operation: () => Promise<Record<string, unknown>>): Promise<CallToolResult> {
  try {
    const output = await operation();
    return { content: [{ type: "text", text: JSON.stringify(output) }], structuredContent: output };
  } catch (error) {
    const code = error instanceof McpToolError ? error.code : error instanceof ZodError ? "invalid_task" : "generic";
    return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: code }) }], structuredContent: { error: code } };
  }
}

export function createTaskTools(operations: TaskOperations) {
  return {
    list_projects: (raw: unknown) => result(async () => {
      listProjectsToolSchema.parse(raw);
      return { projects: await operations.listProjects() };
    }),
    list_tasks: (raw: unknown) => result(async () => {
      const filters = listTasksToolSchema.parse(raw);
      return filterTasks(await operations.listTasks(), filters);
    }),
    add_tasks: (raw: unknown) => result(async () => ({ tasks: await operations.addTasks(addTasksToolSchema.parse(raw).tasks) })),
    update_task: (raw: unknown) => result(async () => {
      const { id, patch } = updateTaskToolSchema.parse(raw);
      const updated = await operations.updateTask(id, patch);
      if (!updated) throw new McpToolError("not_found");
      return updated;
    }),
    complete_task: (raw: unknown) => result(async () => {
      const { id } = completeTaskToolSchema.parse(raw);
      const updated = await operations.updateTask(id, { done: true });
      if (!updated) throw new McpToolError("not_found");
      return updated;
    }),
    delete_task: (raw: unknown) => result(async () => {
      const { id } = deleteTaskToolSchema.parse(raw);
      if (!await operations.deleteTask(id)) throw new McpToolError("not_found");
      return { deleted: true, id };
    }),
  };
}
