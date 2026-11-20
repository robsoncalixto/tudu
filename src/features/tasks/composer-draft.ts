import type { Project } from "@/features/projects/schema";
import { quickAddApi } from "@/features/quick-add/api";
import { normalizeQuickTag, type QuickAddDefaults } from "@/features/quick-add/schema";
import { repeatFrom, type RepeatFrequency } from "@/features/recurrence/schema";
import type { PartOfDay, Priority, Task, TaskPatch } from "./schema";

export const MAX_DRAFT_TAGS = 10;

/** What the person picked with the chips. A missing field follows the current view. */
export interface ComposerChoice {
  priority?: Priority;
  due?: string;
  estimateHours?: number;
  repeat?: RepeatFrequency;
  partOfDay?: PartOfDay;
  /** `null` drops the day or project that the current view would add. */
  plannedFor?: string | null;
  projectId?: string | null;
  tags: string[];
  withoutViewTag?: boolean;
}

export const NO_CHOICE: ComposerChoice = { tags: [] };

/** The chips on top of the view: the defaults every typed line starts from. */
export function composerDefaults(view: QuickAddDefaults, choice: ComposerChoice): QuickAddDefaults {
  const plannedFor = choice.plannedFor === undefined ? view.plannedFor : choice.plannedFor;
  const projectId = choice.projectId === undefined ? view.projectId : choice.projectId;
  return {
    tags: choice.tags,
    ...(choice.priority ? { priority: choice.priority } : {}),
    ...(choice.due ? { due: choice.due } : {}),
    ...(choice.estimateHours === undefined ? {} : { estimateHours: choice.estimateHours }),
    ...(choice.repeat ? { repeat: choice.repeat } : {}),
    ...(choice.partOfDay ? { partOfDay: choice.partOfDay } : {}),
    ...(plannedFor ? { plannedFor } : {}),
    ...(projectId ? { projectId } : {}),
    ...(view.tag && !choice.withoutViewTag ? { tag: view.tag } : {}),
  };
}

export interface ComposerValues {
  /** Several lines: the chips are defaults and each line keeps its own tokens. */
  batch: boolean;
  /** `null` leaves the saved default priority. */
  priority: Priority | null;
  due: string | null;
  time: string | null;
  partOfDay: PartOfDay | null;
  plannedFor: string | null;
  projectId: string | null;
  tags: string[];
  estimateHours: number | null;
  repeat: RepeatFrequency | null;
}

/** What the chips show: for one line, the typed tokens over the defaults. */
export function composerValues(text: string, today: string, defaults: QuickAddDefaults, projects: readonly Project[]): ComposerValues {
  const lines = text.split(/\r?\n/u).filter((line) => line.trim());
  const typed = lines.length === 1 ? quickAddApi.parse(lines[0], today, projects) : null;
  const tags = new Map([...(typed?.tags ?? []), ...(defaults.tags ?? [])].map((tag) => [normalizeQuickTag(tag), normalizeQuickTag(tag)]));
  if (defaults.tag) tags.set(normalizeQuickTag(defaults.tag), defaults.tag);
  return {
    batch: lines.length > 1,
    priority: typed?.priority ?? defaults.priority ?? null,
    // Repeating starts from a date and a part of the day belongs to a day, so a task without a date is due today.
    due: typed?.due ?? defaults.due ?? ((defaults.repeat || defaults.partOfDay) && today ? today : null),
    time: typed?.time ?? null,
    partOfDay: typed?.partOfDay ?? defaults.partOfDay ?? null,
    plannedFor: defaults.plannedFor ?? null,
    projectId: typed?.project ?? defaults.projectId ?? null,
    tags: [...tags.values()].filter(Boolean),
    estimateHours: typed?.estimate ?? defaults.estimateHours ?? null,
    repeat: defaults.repeat ?? null,
  };
}

/**
 * AI capture takes priority, dates, project and tags as defaults but has no field for an estimate,
 * a repeat or a part of the day. Those chips become a change to each task it created; `null` when there is none.
 */
export function chipsAfterCapture(defaults: QuickAddDefaults, task: Pick<Task, "due">, today: string): TaskPatch | null {
  const due = task.due ?? today;
  const changes: TaskPatch = {
    ...(defaults.estimateHours == null ? {} : { estimateHours: defaults.estimateHours }),
    ...(defaults.partOfDay ? { due, partOfDay: defaults.partOfDay } : {}),
    ...(defaults.repeat ? { due, repeat: repeatFrom(defaults.repeat, due) } : {}),
  };
  return Object.keys(changes).length ? changes : null;
}

export function withTag(choice: ComposerChoice, tag: string): ComposerChoice {
  const value = normalizeQuickTag(tag);
  return value && !choice.tags.includes(value) ? { ...choice, tags: [...choice.tags, value] } : choice;
}

export function withoutTag(choice: ComposerChoice, tag: string, viewTag?: string): ComposerChoice {
  return {
    ...choice, tags: choice.tags.filter((item) => item !== tag),
    ...(viewTag !== undefined && normalizeQuickTag(viewTag) === normalizeQuickTag(tag) ? { withoutViewTag: true } : {}),
  };
}
