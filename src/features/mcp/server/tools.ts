import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { taskDraftSchema, taskPatchSchema, type Task, type TaskDraft, type TaskPatch, type TaskUpdate } from "@/features/tasks/schema";
import type { Project, ProjectInput } from "@/features/projects/schema";
import { addTasksToolSchema, completeTaskToolSchema, createProjectToolSchema, deleteTaskToolSchema, listTasksToolSchema, listProjectsToolSchema, updateTaskToolSchema } from "../schema";
import { filterTasks } from "../selectors";

export interface TaskOperations {
  listTasks(): Promise<Task[]>;
  isForToday(task: Task, today: string): boolean;
  listProjects(): Promise<Project[]>;
  createProject(input: ProjectInput): Promise<Project>;
  addTasks(inputs: TaskDraft[]): Promise<Task[]>;
  updateTask(id: string, patch: TaskPatch, expected?: Task): Promise<TaskUpdate | null>;
  deleteTask(id: string): Promise<boolean>;
}
export class McpToolError extends Error {
  constructor(public readonly code: "not_found" | "invalid_project" | "duplicate_project" | "invalid_repeat" | "task_changed") { super(code); }
}

async function result(name: string, operation: () => Promise<Record<string, unknown>>): Promise<CallToolResult> {
  try {
    const output = await operation();
    return { content: [{ type: "text", text: JSON.stringify(output) }], structuredContent: output };
  } catch (error) {
    const code = error instanceof McpToolError ? error.code : error instanceof ZodError ? "invalid_task" : "generic";
    // The client only sees the code; the server log keeps the cause so failures can be diagnosed.
    if (code === "generic") console.error(`MCP tool ${name} failed`, error);
    return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: code }) }], structuredContent: { error: code } };
  }
}

function withStepIds<T extends { steps?: { id?: string }[] }>(fields: T): T {
  return fields.steps ? { ...fields, steps: fields.steps.map((step) => ({ ...step, id: step.id ?? randomUUID() })) } : fields;
}

export function createTaskTools(operations: TaskOperations) {
  return {
    list_projects: (raw: unknown) => result("list_projects", async () => {
      listProjectsToolSchema.parse(raw);
      return { projects: await operations.listProjects() };
    }),
    create_project: (raw: unknown) => result("create_project", async () => {
      const parsed = createProjectToolSchema.safeParse(raw);
      if (!parsed.success) throw new McpToolError("invalid_project");
      return { project: await operations.createProject(parsed.data) };
    }),
    list_tasks: (raw: unknown) => result("list_tasks", async () => {
      const filters = listTasksToolSchema.parse(raw);
      return filterTasks(await operations.listTasks(), filters, operations.isForToday);
    }),
    add_tasks: (raw: unknown) => result("add_tasks", async () => {
      const drafts = addTasksToolSchema.parse(raw).tasks.map((draft) => taskDraftSchema.strict().parse(withStepIds(draft)));
      return { tasks: await operations.addTasks(drafts) };
    }),
    update_task: (raw: unknown) => result("update_task", async () => {
      const { id, patch, expected } = updateTaskToolSchema.parse(raw);
      const updated = await operations.updateTask(id, taskPatchSchema.strict().parse(withStepIds(patch)), expected);
      if (!updated) throw new McpToolError("not_found");
      return updated;
    }),
    complete_task: (raw: unknown) => result("complete_task", async () => {
      const { id } = completeTaskToolSchema.parse(raw);
      const updated = await operations.updateTask(id, { done: true });
      if (!updated) throw new McpToolError("not_found");
      return updated;
    }),
    delete_task: (raw: unknown) => result("delete_task", async () => {
      const { id } = deleteTaskToolSchema.parse(raw);
      if (!await operations.deleteTask(id)) throw new McpToolError("not_found");
      return { deleted: true, id };
    }),
  };
}
