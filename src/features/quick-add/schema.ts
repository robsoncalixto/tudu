import { z } from "zod";
import { taskDraftSchema } from "@/features/tasks/schema";

export const quickAddInputSchema = z.object({ text: z.string().trim().min(1).max(8000), today: z.iso.date() });
// Leaving priority absent lets the server apply the shared default at save time.
export const quickTaskSchema = taskDraftSchema;
export type QuickTask = z.infer<typeof quickTaskSchema>;
