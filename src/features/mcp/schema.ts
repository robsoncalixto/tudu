import { z } from "zod";
import { PRIORITIES, stepSchema, taskDraftSchema, taskPatchSchema, taskSchema, taskUpdateSchema } from "@/features/tasks/schema";
import { projectIdSchema, projectSchema } from "@/features/projects/schema";

export const listTasksToolSchema = z.object({
  state: z.enum(["all", "open", "done"]).default("all"),
  tag: z.string().trim().min(1).max(40).optional(),
  projectId: projectIdSchema.optional().describe("Use null for unassigned tasks."),
  priority: z.enum(PRIORITIES).optional(),
  dueFrom: z.iso.date().optional().describe("Inclusive earliest due date; excludes undated tasks."),
  dueTo: z.iso.date().optional().describe("Inclusive latest due date; excludes undated tasks."),
  plannedFor: z.iso.date().optional(),
  today: z.iso.date().optional().describe("Tasks planned for this day, unfinished tasks planned before it, and tasks due on or before it."),
  query: z.string().trim().min(1).max(300).optional().describe("Case-insensitive title or notes search."),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(200).default(100),
}).strict().refine((input) => !input.dueFrom || !input.dueTo || input.dueFrom <= input.dueTo);
export type TaskFilters = z.infer<typeof listTasksToolSchema>;
export const listProjectsToolSchema = z.object({}).strict();

// Clients cannot know which ids are free, so new steps may omit theirs and the server assigns one.
const toolStepsSchema = z.array(stepSchema.extend({
  id: stepSchema.shape.id.optional().describe("Omit for a new step. Keep the existing id when editing or reordering a step."),
}).strict()).max(100);
export const addTasksToolSchema = z.object({
  tasks: z.array(taskDraftSchema.extend({ steps: toolStepsSchema.default([]) }).strict()).min(1).max(50),
}).strict();
export const updateTaskToolSchema = z.object({
  id: z.string().min(1).max(100),
  patch: taskPatchSchema.extend({ steps: toolStepsSchema.optional() }).strict()
    .refine((patch) => Object.keys(patch).length > 0),
  expected: taskSchema.optional().describe("The task exactly as last read. When given, the update is refused with task_changed if the task changed since."),
}).strict();
export const completeTaskToolSchema = z.object({ id: z.string().min(1).max(100) }).strict();
export const deleteTaskToolSchema = completeTaskToolSchema.extend({
  confirm: z.literal(true).describe("Set true only after the user explicitly confirms permanent deletion of this exact task."),
}).strict();

export const listProjectsOutputSchema = z.object({ projects: z.array(projectSchema) });
export const listTasksOutputSchema = z.object({
  tasks: z.array(taskSchema),
  total: z.number().int().min(0),
  nextOffset: z.number().int().min(0).nullable(),
});
export const addTasksOutputSchema = z.object({ tasks: z.array(taskSchema) });
export const taskUpdateOutputSchema = taskUpdateSchema;
export const deleteTaskOutputSchema = z.object({ deleted: z.literal(true), id: z.string() });
