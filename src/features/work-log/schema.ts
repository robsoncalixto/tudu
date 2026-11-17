import { z } from "zod";
import { taskSchema } from "@/features/tasks/schema";

export const GROUPINGS = ["project", "tag", "none"] as const;
export const groupingSchema = z.enum(GROUPINGS);
export type Grouping = z.infer<typeof groupingSchema>;

export const workLogQuerySchema = z.object({
  day: z.iso.date(),
  timeZone: z.string().max(100).refine((value) => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
    catch { return false; }
  }),
}).strict();
export type WorkLogQuery = z.infer<typeof workLogQuerySchema>;
export const workLogGroupSchema = z.object({
  key: z.string(), kind: groupingSchema, label: z.string().nullable(), tasks: z.array(taskSchema),
});
export type WorkLogGroup = z.infer<typeof workLogGroupSchema>;
export const summarySchema = z.object({ summary: z.string().trim().min(1).max(2000) });
export type WorkLogSummary = z.infer<typeof summarySchema>;
