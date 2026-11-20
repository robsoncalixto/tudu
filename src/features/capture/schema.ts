import { z } from "zod";
import { calendarDateSchema } from "@/lib/dates";
import { taskDraftSchema } from "@/features/tasks/schema";

export const captureDefaultsSchema = taskDraftSchema.pick({ priority: true, due: true, tags: true, projectId: true, plannedFor: true })
  .partial().extend({ due: calendarDateSchema.nullable().optional() }).strict();
export type CaptureDefaults = z.infer<typeof captureDefaultsSchema>;

export const captureRequestSchema = z.object({
  text: z.string().trim().min(1).max(8000),
  today: calendarDateSchema,
  defaults: captureDefaultsSchema.optional(),
});
