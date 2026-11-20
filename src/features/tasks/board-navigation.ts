import { z } from "zod";
import { settingsSchema } from "@/features/settings/schema";
import { projectSchema } from "@/features/projects/schema";
import { taskInputSchema } from "./schema";

export const TASK_SORTS = ["due", "priority", "newest"] as const;
export type TaskSort = (typeof TASK_SORTS)[number];

const taskSortSchema = z.enum(TASK_SORTS);

export function restoreTaskSort(saved: string | null): TaskSort {
  return taskSortSchema.safeParse(saved).data ?? "due";
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

export type StartView = z.infer<typeof settingsSchema.shape.startView>;

export function boardFilterForPage(page: string, filter: TaskFilter): TaskFilter | null {
  return page === "/" ? filter : null;
}
