import { z } from "zod";
import { PRIORITIES, taskInputSchema } from "@/features/tasks/schema";

export const quickAddInputSchema = z.object({ text: z.string().trim().min(1).max(8000), today: z.iso.date() });
// Leaving priority absent lets the server apply the shared default at save time.
export const quickTaskSchema = taskInputSchema.extend({ priority: z.enum(PRIORITIES).optional() });
export type QuickTask = z.infer<typeof quickTaskSchema>;
