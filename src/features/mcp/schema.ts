import { z } from "zod";
import { PRIORITIES, taskDraftSchema, taskPatchSchema } from "@/features/tasks/schema";
import { projectIdSchema } from "@/features/projects/schema";

export const listTasksToolSchema = z.object({
  state: z.enum(["all", "open", "done"]).default("all"),
  tag: z.string().trim().min(1).max(40).optional(),
  projectId: projectIdSchema.optional().describe("Use null for unassigned tasks."),
  priority: z.enum(PRIORITIES).optional(),
  dueFrom: z.iso.date().optional().describe("Inclusive earliest due date; excludes undated tasks."),
  dueTo: z.iso.date().optional().describe("Inclusive latest due date; excludes undated tasks."),
  plannedFor: z.iso.date().optional(),
  today: z.iso.date().optional().describe("Tasks selected for this day, due on it, or overdue, as in Today view."),
  query: z.string().trim().min(1).max(300).optional().describe("Case-insensitive title or notes search."),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(200).default(100),
}).strict().refine((input) => !input.dueFrom || !input.dueTo || input.dueFrom <= input.dueTo);
export type TaskFilters = z.infer<typeof listTasksToolSchema>;
export const listProjectsToolSchema = z.object({}).strict();
export const addTasksToolSchema = z.object({ tasks: z.array(taskDraftSchema.strict()).min(1).max(50) }).strict();
export const updateTaskToolSchema = z.object({
  id: z.string().min(1).max(100),
  patch: taskPatchSchema.strict().refine((patch) => Object.keys(patch).length > 0),
}).strict();
export const completeTaskToolSchema = z.object({ id: z.string().min(1).max(100) }).strict();
export const deleteTaskToolSchema = completeTaskToolSchema.extend({
  confirm: z.literal(true).describe("Set true only after the user explicitly confirms permanent deletion of this exact task."),
}).strict();
