import { z } from "zod";
import { taskDraftSchema } from "@/features/tasks/schema";

export const captureDefaultsSchema = taskDraftSchema.pick({ priority: true, due: true, tags: true, projectId: true, plannedFor: true })
  .partial().extend({ due: z.iso.date().nullable().optional() }).strict();
export type CaptureDefaults = z.infer<typeof captureDefaultsSchema>;

export const captureRequestSchema = z.object({
  text: z.string().trim().min(1).max(8000),
  today: z.iso.date(),
  defaults: captureDefaultsSchema.optional(),
});
