import { z } from "zod";
import { projectIdSchema } from "@/features/projects/schema";
import { repeatRuleSchema } from "@/features/recurrence/schema";
import { calendarDateSchema } from "@/lib/dates";

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const MAX_DURATION_HOURS = 8760;
export const DURATION_UNITS = ["minutes", "hours", "days"] as const;
export const durationUnitSchema = z.enum(DURATION_UNITS);
export type DurationUnit = z.infer<typeof durationUnitSchema>;
export const HOURS_PER_UNIT: Record<DurationUnit, number> = { minutes: 1 / 60, hours: 1, days: 12 };
export const durationHoursSchema = z.number().positive().max(MAX_DURATION_HOURS).nullable();
export const durationDraftSchema = z.object({
  value: z.string(), unit: durationUnitSchema, hours: durationHoursSchema.optional(),
});
export type DurationDraft = z.infer<typeof durationDraftSchema>;
export const MAX_TASK_LINKS = 20;
export const MAX_TASK_LINK_LENGTH = 2048;
export const taskLinkSchema = z.string().trim().max(MAX_TASK_LINK_LENGTH)
  .regex(/^https?:\/\/[^/\s\\?#]+(?:[/?#][^\s\\]*)?$/i).pipe(z.url({ protocol: /^https?$/ }));
const linksSchema = z.array(taskLinkSchema).max(MAX_TASK_LINKS)
  .refine((links) => new Set(links).size === links.length);

export const PARTS_OF_DAY = ["morning", "afternoon", "evening"] as const;
export const partOfDaySchema = z.enum(PARTS_OF_DAY);
export type PartOfDay = z.infer<typeof partOfDaySchema>;

const taskDate = calendarDateSchema.nullable();

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
  due: taskDate.default(null),
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
    due: taskDate,
    tags: z.array(z.string().trim().min(1).max(40)).max(10),
    done: z.boolean(),
    plannedFor: taskDate,
    partOfDay: partOfDaySchema.nullable().describe("Optional morning, afternoon or evening plan."),
    steps: stepsSchema,
    projectId: projectIdSchema,
    repeat: repeatRuleSchema.nullable(),
    estimateHours: durationHoursSchema.describe("Estimated effort in hours. One day is 12 hours."),
    realTimeHours: durationHoursSchema.describe("Actual execution time in hours. One day is 12 hours."),
    links: linksSchema,
  })
  .partial();
export const taskDatePatchSchema = taskPatchSchema.pick({ due: true, plannedFor: true });

export type TaskInput = z.infer<typeof taskInputSchema>;
const taskCreationInputSchema = taskInputSchema.extend({
  plannedFor: taskDate.optional(),
  partOfDay: taskPatchSchema.shape.partOfDay,
  estimateHours: taskPatchSchema.shape.estimateHours,
  realTimeHours: taskPatchSchema.shape.realTimeHours,
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

export const newTaskSchema = taskInputSchema.extend({
  id: z.string(),
  done: z.boolean(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  plannedFor: taskDate.default(null),
  partOfDay: partOfDaySchema.nullable().default(null),
  dayRanks: z.record(z.iso.date(), z.number().int().nonnegative()).default({}),
  planChangedAt: z.iso.datetime().nullable().default(null),
  nextOccurrenceId: z.string().nullable().default(null),
  estimateHours: durationHoursSchema.default(null),
  realTimeHours: durationHoursSchema.default(null),
  links: linksSchema.default([]),
});

// Preserve dates accepted by older JSON files so their tasks remain editable.
export const taskSchema = newTaskSchema.extend({
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  plannedFor: z.iso.date().nullable().default(null),
});
export type Task = z.infer<typeof taskSchema>;
export const taskContentSchema = taskSchema.omit({ dayRanks: true, planChangedAt: true });

// Old JSON files and proposal snapshots used minutes; never reinterpret them as hours.
export const storedTaskSchema = z.object({
  estimateMinutes: z.number().int().min(1).max(525600).nullable().optional(),
  estimateHours: durationHoursSchema.optional(),
}).passthrough().transform(({ estimateMinutes, ...task }) => ({
  ...task,
  ...(task.estimateHours === undefined && estimateMinutes !== undefined
    ? { estimateHours: estimateMinutes === null ? null : estimateMinutes / 60 } : {}),
})).pipe(taskSchema);

export const taskListSchema = z.object({ tasks: z.array(taskSchema) });
export const taskUpdateSchema = z.object({ task: taskSchema, nextTask: taskSchema.nullable().default(null) });
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;

const dayTaskIds = z.array(z.string().min(1).max(100)).max(10_000).refine((ids) => new Set(ids).size === ids.length);
export const dayOrderSchema = z.object({ day: z.iso.date(), taskIds: dayTaskIds }).strict();
export const dayOrderRequestSchema = dayOrderSchema.extend({ expected: dayTaskIds.optional() }).strict();
export const dayOrderResponseSchema = z.object({ order: dayOrderSchema });
export type DayOrder = z.infer<typeof dayOrderSchema>;
export type DayOrderRequest = z.infer<typeof dayOrderRequestSchema>;
