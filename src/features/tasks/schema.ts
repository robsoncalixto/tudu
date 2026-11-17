import { z } from "zod";

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

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
});

export const taskPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    notes: z.string().trim().max(2000),
    priority: z.enum(PRIORITIES),
    due: dueDate,
    tags: z.array(z.string().trim().min(1).max(40)).max(10),
    done: z.boolean(),
    plannedFor: z.iso.date().nullable(),
    steps: stepsSchema,
  })
  .partial();

export type TaskInput = z.infer<typeof taskInputSchema>;
export type TaskPatch = z.infer<typeof taskPatchSchema>;

export const taskSchema = taskInputSchema.extend({
  id: z.string(),
  done: z.boolean(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  plannedFor: z.iso.date().nullable().default(null),
});

export type Task = z.infer<typeof taskSchema>;
