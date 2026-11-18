import { z } from "zod";
import { projectIdSchema } from "@/features/projects/schema";
import { repeatRuleSchema } from "@/features/recurrence/schema";

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const MAX_ESTIMATE_MINUTES = 525600;
export const MAX_TASK_LINKS = 20;
export const MAX_TASK_LINK_LENGTH = 2048;
export const estimateMinutesSchema = z.number().int().min(1).max(MAX_ESTIMATE_MINUTES).nullable();
export const taskLinkSchema = z.string().trim().max(MAX_TASK_LINK_LENGTH)
  .regex(/^https?:\/\/[^/\s\\?#]+(?:[/?#][^\s\\]*)?$/i).pipe(z.url({ protocol: /^https?$/ }));
const linksSchema = z.array(taskLinkSchema).max(MAX_TASK_LINKS)
  .refine((links) => new Set(links).size === links.length);

const plannedDay = z.iso.date().nullable();

const dueDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

export const stepSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(300),
  done: z.boolean().default(false),
});

const stepsSchema = z.array(stepSchema).max(100).refine(
  (steps) => new Set(steps.map((step) => step.id)).size === steps.length,
  { message: "Step ids must be unique" },
);
export type Step = z.infer<typeof stepSchema>;

export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  notes: z.string().trim().max(2000).default(""),
  priority: z.enum(PRIORITIES).default("medium"),
  due: dueDate.default(null),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  steps: stepsSchema.default([]),
  projectId: projectIdSchema.default(null),
  repeat: repeatRuleSchema.nullable().default(null),
});

export const taskPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    notes: z.string().trim().max(2000),
    priority: z.enum(PRIORITIES),
    due: dueDate,
    tags: z.array(z.string().trim().min(1).max(40)).max(10),
    done: z.boolean(),
    plannedFor: plannedDay,
    steps: stepsSchema,
    projectId: projectIdSchema,
    repeat: repeatRuleSchema.nullable(),
    estimateMinutes: estimateMinutesSchema,
    links: linksSchema,
  })
  .partial();

export type TaskInput = z.infer<typeof taskInputSchema>;
const taskCreationInputSchema = taskInputSchema.extend({
  plannedFor: plannedDay.optional(),
  estimateMinutes: estimateMinutesSchema.optional(),
  links: linksSchema.optional(),
});
export type TaskCreationInput = z.infer<typeof taskCreationInputSchema>;
export const taskDraftSchema = taskCreationInputSchema.extend({ priority: z.enum(PRIORITIES).optional() });
export type TaskDraft = z.input<typeof taskDraftSchema>;
export type TaskPatch = z.infer<typeof taskPatchSchema>;

export function taskCreationSchema(defaultPriority: Priority) {
  const input = taskDraftSchema.extend({ priority: z.enum(PRIORITIES).default(defaultPriority) });
  return z.union([input, z.array(input).min(1).max(50)]);
}

export const taskSchema = taskInputSchema.extend({
  id: z.string(),
  done: z.boolean(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  plannedFor: plannedDay.default(null),
  nextOccurrenceId: z.string().nullable().default(null),
  estimateMinutes: estimateMinutesSchema.default(null),
  links: linksSchema.default([]),
});

export type Task = z.infer<typeof taskSchema>;

export const taskListSchema = z.object({ tasks: z.array(taskSchema) });
export const taskUpdateSchema = z.object({ task: taskSchema, nextTask: taskSchema.nullable().default(null) });
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
