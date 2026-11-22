import { z } from "zod";
import { settingsSchema } from "@/features/settings/schema";
import { projectSchema } from "@/features/projects/schema";
import { normalizeQuickTag } from "@/features/quick-add/schema";
import { calendarDayOrNull } from "@/lib/dates";
import { composerChoiceSchema } from "./composer-draft";
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
  listSort: taskSortSchema.exclude(["manual"]).optional().catch(undefined),
  daySort: taskSortSchema.optional().catch(undefined),
  sort: taskSortSchema.optional().catch(undefined),
  text: z.string(),
  choice: composerChoiceSchema.optional().catch(undefined),
  details: z.object({
    priority: taskInputSchema.shape.priority.unwrap().optional(),
    due: z.iso.date().optional(),
    tags: taskInputSchema.shape.tags.unwrap(),
    tagInput: z.string().max(40),
  }).optional().catch(undefined),
});
export type BoardReturn = Omit<z.infer<typeof boardReturnSchema>, "sort" | "details">;
export type ComposerDraft = Pick<BoardReturn, "text" | "choice">;

export function restoreBoardReturn(serialized: string | null, startView: BoardReturn["startView"]): BoardReturn | null {
  if (!serialized) return null;
  try {
    const { sort, details, ...previous } = boardReturnSchema.parse(JSON.parse(serialized));
    if (!previous.choice && details) {
      // The old composer included the uncommitted tag when submitted.
      const tag = normalizeQuickTag(details.tagInput);
      const tags = [...new Set([...details.tags, ...(tag ? [tag] : [])])].slice(0, 10);
      previous.choice = {
        priority: details.priority, due: calendarDayOrNull(details.due ?? null) ?? undefined,
        tags, tagInput: details.tagInput,
      };
    }
    // Older sessions kept one unsaved sort alongside their active filter.
    if (sort) {
      if (previous.filter.kind === "today") previous.daySort ??= sort;
      else if (sort !== "manual") previous.listSort ??= sort;
    }
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
