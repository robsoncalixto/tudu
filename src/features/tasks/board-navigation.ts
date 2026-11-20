import { z } from "zod";
import { settingsSchema } from "@/features/settings/schema";
import { projectSchema } from "@/features/projects/schema";
import { taskInputSchema } from "./schema";

export const TASK_SORTS = ["due", "priority", "newest", "manual"] as const;
export type TaskSort = (typeof TASK_SORTS)[number];

const taskSortSchema = z.enum(TASK_SORTS);

export function restoreTaskSort(saved: string | null, fallback: TaskSort = "due"): TaskSort {
  const value = taskSortSchema.safeParse(saved).data;
  return value && (value !== "manual" || fallback === "manual") ? value : fallback;
}

const sidebarLayoutSchema = z.object({
  compact: z.boolean().default(false),
  projects: z.boolean().default(true),
  tags: z.boolean().default(true),
});
export type SidebarLayout = z.infer<typeof sidebarLayoutSchema>;

export function restoreSidebarLayout(serialized: string | null): SidebarLayout {
  try {
    return sidebarLayoutSchema.parse(JSON.parse(serialized ?? "{}"));
  } catch {
    return sidebarLayoutSchema.parse({});
  }
}

const filterSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }),
  z.object({ kind: z.literal("today") }),
  z.object({ kind: z.literal("project"), id: projectSchema.shape.id }),
  z.object({ kind: z.literal("tag"), tag: taskInputSchema.shape.tags.unwrap().element }),
]);
export type TaskFilter = z.infer<typeof filterSchema>;

const boardReturnSchema = z.object({
  startView: settingsSchema.shape.startView.unwrap(),
  filter: filterSchema,
  query: z.string(),
  sort: taskSortSchema.optional().catch(undefined),
  text: z.string(),
  details: z.object({
    priority: taskInputSchema.shape.priority.unwrap().optional(),
    due: z.iso.date().optional(),
    tags: taskInputSchema.shape.tags.unwrap(),
    tagInput: z.string().max(40),
  }).optional().catch(undefined),
});
export type BoardReturn = z.infer<typeof boardReturnSchema>;

export function restoreBoardReturn(serialized: string | null, startView: BoardReturn["startView"]): BoardReturn | null {
  if (!serialized) return null;
  try {
    const previous = boardReturnSchema.parse(JSON.parse(serialized));
    if (previous.startView === startView) return previous;
    return { ...previous, startView, filter: { kind: startView }, query: "" };
  } catch {
    return null;
  }
}

export type StartView = BoardReturn["startView"];

export function boardFilterForPage(page: string, filter: TaskFilter): TaskFilter | null {
  return page === "/" ? filter : null;
}
