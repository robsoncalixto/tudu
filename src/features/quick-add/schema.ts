import { z } from "zod";
import { taskDraftSchema } from "@/features/tasks/schema";

export const quickAddInputSchema = z.object({ text: z.string().trim().min(1).max(40_000), today: z.iso.date() });
// Leaving priority absent lets the server apply the shared default at save time.
export const quickTaskSchema = taskDraftSchema;
export type QuickTask = z.infer<typeof quickTaskSchema>;
export type QuickAddDefaults = Pick<QuickTask, "priority" | "plannedFor"> & {
  due?: QuickTask["due"];
  projectId?: QuickTask["projectId"];
  tags?: QuickTask["tags"];
  tag?: string;
};

export function normalizeQuickTag(value: string): string {
  return value.trim().replace(/^#/, "").trim().normalize("NFC").toLowerCase();
}

export type QuickAddProblem = { kind: "text_limit" | "line_limit" } | { kind: "tag_limit" | "line_invalid"; line: number };
