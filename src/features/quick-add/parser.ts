import { z } from "zod";
import type { Project } from "@/features/projects/schema";
import { durationHoursSchema, HOURS_PER_UNIT, PRIORITIES, type Priority } from "@/features/tasks/schema";
import { quickAddInputSchema, quickTaskSchema, normalizeQuickTag, type QuickAddDefaults, type QuickAddProblem, type QuickTask } from "./schema";

const WEEKDAYS: Record<string, number> = {
  sunday: 0, domingo: 0,
  monday: 1, "segunda-feira": 1,
  tuesday: 2, "terca-feira": 2,
  wednesday: 3, "quarta-feira": 3,
  thursday: 4, "quinta-feira": 4,
  friday: 5, "sexta-feira": 5,
  saturday: 6, sabado: 6,
};
const RELATIVE_DAYS: Record<string, number> = { today: 0, hoje: 0, tomorrow: 1, amanha: 1 };
const wordKey = (token: string) => token.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function isDateShortcut(token: string): boolean {
  const word = wordKey(token);
  return z.iso.date().safeParse(token).success || Object.hasOwn(RELATIVE_DAYS, word) || Object.hasOwn(WEEKDAYS, word);
}

function dateToken(token: string, today: string): string | null {
  if (z.iso.date().safeParse(token).success) return token;
  const word = wordKey(token);
  const date = new Date(`${today}T12:00:00Z`);
  if (Object.hasOwn(RELATIVE_DAYS, word)) date.setUTCDate(date.getUTCDate() + RELATIVE_DAYS[word]);
  else if (Object.hasOwn(WEEKDAYS, word)) {
    date.setUTCDate(date.getUTCDate() + ((WEEKDAYS[word] - date.getUTCDay() + 7) % 7 || 7));
  } else return null;
  // Refuse calendar overflow instead of silently dropping a recognized shortcut.
  return z.iso.date().parse(date.toISOString().slice(0, 10));
}

function priorityToken(token: string): Priority | undefined {
  const priority = token.slice(1).toLowerCase();
  return token.startsWith("!") && PRIORITIES.includes(priority as Priority) ? priority as Priority : undefined;
}

function tagToken(token: string): string | null {
  const match = /^#([\p{L}\p{N}_-]+)$/u.exec(token.normalize("NFC"));
  return match ? match[1].toLowerCase() : null;
}

const estimateSyntax = /^~(\d+(?:[.,]\d+)?)([mhd])$/i;
const durationUnits = { m: "minutes", h: "hours", d: "days" } as const;

function estimateToken(token: string) {
  const match = estimateSyntax.exec(token);
  if (!match) return undefined;
  const unit = durationUnits[match[2].toLowerCase() as keyof typeof durationUnits];
  const parsed = durationHoursSchema.safeParse(Number(match[1].replace(",", ".")) * HOURS_PER_UNIT[unit]);
  return parsed.success ? parsed.data ?? undefined : undefined;
}

function projectToken(token: string, projects: readonly Project[]): string | undefined {
  if (!token.startsWith("@")) return undefined;
  const key = wordKey(token.slice(1));
  const matches = projects.filter(({ name }) => wordKey(name.replace(/\s+/gu, "-")) === key);
  // Two saved names can differ only in accents or in how their spaces are written.
  return matches.length === 1 ? matches[0].id : undefined;
}

export function stripQuickTokens(text: string, field: "priority" | "due" | "tag", tag?: string): string {
  return text.replace(/\S+/gu, (token) => {
    const matches = field === "priority" ? priorityToken(token) : field === "due" ? isDateShortcut(token) : tagToken(token) === tag;
    return matches ? "" : token;
  });
}

/** Shortcuts are separate whitespace-delimited words; no clock or locale is read. */
export function parseQuickTask(text: string, today: string, projects: readonly Project[] = []): QuickTask {
  const parsed = quickAddInputSchema.parse({ text, today });
  const title: string[] = [];
  const tags = new Set<string>();
  let priority: Priority | undefined;
  let due: string | null = null;
  let projectId: string | undefined;
  let estimateHours: number | undefined;
  for (const token of parsed.text.split(/\s+/u)) {
    if (token.startsWith("\\")) {
      const literal = token.slice(1);
      const isShortcut = tagToken(literal) || priorityToken(literal) || isDateShortcut(literal) ||
        (literal.startsWith("@") && literal.length > 1) || estimateSyntax.test(literal);
      title.push(isShortcut ? literal : token);
      continue;
    }
    const tag = tagToken(token);
    const level = priorityToken(token);
    const date = dateToken(token, parsed.today);
    const project = projectToken(token, projects);
    const estimate = estimateToken(token);
    if (tag) tags.add(tag);
    else if (level) priority = level;
    else if (date) due = date;
    else if (project) projectId = project;
    else if (estimate !== undefined) estimateHours = estimate;
    else title.push(token);
  }
  return quickTaskSchema.parse({
    title: title.join(" "), tags: [...tags], due,
    ...(priority ? { priority } : {}), ...(projectId ? { projectId } : {}),
    ...(estimateHours === undefined ? {} : { estimateHours }),
  });
}

export class QuickDraftError extends Error {
  constructor(public problem: QuickAddProblem) { super(problem.kind); }
}

export function quickTaskDrafts(text: string, today: string, defaults: QuickAddDefaults, projects: readonly Project[]): QuickTask[] {
  if (text.trim().length > 40_000) throw new QuickDraftError({ kind: "text_limit" });
  quickAddInputSchema.parse({ text, today });
  const lines = text.split(/\r?\n/u).flatMap((line, index) => line.trim() ? [{ line, index }] : []);
  if (lines.length > 50) throw new QuickDraftError({ kind: "line_limit" });
  return lines.map(({ line, index }) => {
    try {
      const task = parseQuickTask(line, today, projects);
      const priority = task.priority ?? defaults.priority;
      const tagsByKey = new Map([...task.tags, ...(defaults.tags ?? [])].map((tag) => [normalizeQuickTag(tag), normalizeQuickTag(tag)]));
      if (defaults.tag) tagsByKey.set(normalizeQuickTag(defaults.tag), defaults.tag);
      const tags = [...tagsByKey.values()].filter(Boolean);
      return quickTaskSchema.parse({
        ...task, tags, due: task.due ?? defaults.due ?? null,
        projectId: task.projectId ?? defaults.projectId ?? null,
        ...(priority ? { priority } : {}), ...(defaults.plannedFor ? { plannedFor: defaults.plannedFor } : {}),
      });
    } catch (error) {
      const tagLimit = error instanceof z.ZodError && error.issues.some((issue) => issue.path[0] === "tags");
      throw new QuickDraftError({ kind: tagLimit ? "tag_limit" : "line_invalid", line: index + 1 });
    }
  });
}
