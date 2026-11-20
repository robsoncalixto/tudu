import { z } from "zod";
import type { Project } from "@/features/projects/schema";
import { taskDraftSchema, taskPatchSchema, type Priority } from "@/features/tasks/schema";

export const quickAddInputSchema = z.object({ text: z.string().trim().min(1).max(40_000), today: z.iso.date() });
// Leaving priority absent lets the server apply the shared default at save time.
export const quickTaskSchema = taskDraftSchema;
export type QuickTask = z.infer<typeof quickTaskSchema>;
export type QuickAddDefaults = Pick<QuickTask, "priority" | "plannedFor" | "estimateHours"> & {
  due?: QuickTask["due"];
  projectId?: QuickTask["projectId"];
  tags?: QuickTask["tags"];
  tag?: string;
};

export function normalizeQuickTag(value: string): string {
  return value.trim().replace(/^#/, "").trim().normalize("NFC").toLowerCase();
}

export type QuickAddProblem = { kind: "text_limit" | "line_limit" } | { kind: "tag_limit" | "line_invalid"; line: number };

export const QUICK_TOKEN_TYPES = ["tag", "project", "due", "priority", "estimate"] as const;
export type QuickTokenType = (typeof QUICK_TOKEN_TYPES)[number];

export interface QuickAddContext {
  /** The local calendar day, YYYY-MM-DD. Dates are not read without it. */
  today: string;
  projects?: readonly Project[];
  /** Words that must stay text even if they read as tokens. */
  literals?: readonly string[];
}

export interface QuickToken {
  type: QuickTokenType;
  /** Tag name, project id, ISO date, priority, or estimate in hours. */
  value: string | number;
  start: number;
  end: number;
}

export interface QuickWarning {
  kind: "date" | "project";
  text: string;
  start: number;
  end: number;
  /** The word is a known date that the calendar cannot hold, so the line cannot be saved. */
  fatal?: true;
}

export interface QuickAddResult {
  title: string;
  tags: string[];
  /** Project id. */
  project: string | null;
  due: string | null;
  /** HH:MM typed with the date. */
  time: string | null;
  priority: Priority | null;
  /** Hours. */
  estimate: number | null;
  tokens: QuickToken[];
  warnings: QuickWarning[];
}

const quickEditChangesSchema = taskPatchSchema.pick({ tags: true, priority: true, due: true, partOfDay: true, projectId: true, estimateHours: true });
export interface QuickEdit {
  title: string;
  /** `tags` holds the tags to add; every other field replaces the saved value. */
  changes: z.infer<typeof quickEditChangesSchema>;
}
