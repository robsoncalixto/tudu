import { z } from "zod";
import type { Project } from "@/features/projects/schema";
import { durationHoursSchema, HOURS_PER_UNIT, type PartOfDay, type Priority } from "@/features/tasks/schema";
import { clockTime, dateWord, dueExpression, isDateWord, wordKey } from "./due-words";
import {
  quickAddInputSchema, quickTaskSchema, normalizeQuickTag,
  type QuickAddContext, type QuickAddDefaults, type QuickAddProblem, type QuickAddResult, type QuickEdit, type QuickTask,
  type QuickToken, type QuickTokenType, type QuickWarning,
} from "./schema";

const PRIORITY_WORDS: Record<string, Priority> = {
  high: "high", medium: "medium", low: "low", alta: "high", media: "medium", baixa: "low", 1: "high", 2: "medium", 3: "low",
};

function priorityToken(token: string): Priority | undefined {
  const word = wordKey(token.slice(1));
  return token.startsWith("!") && Object.hasOwn(PRIORITY_WORDS, word) ? PRIORITY_WORDS[word] : undefined;
}

function tagToken(token: string): string | null {
  const match = /^#([\p{L}\p{N}_-]+)$/u.exec(token.normalize("NFC"));
  return match ? match[1].toLowerCase() : null;
}

// Days, hours and minutes in that order: ~30m, t1h, ~1,5h, t1h30m, t1h30, ~1d2h.
const estimateSyntax = /^(?:~|t)(?:(\d+(?:[.,]\d+)?)d)?(?:(\d+(?:[.,]\d+)?)h)?(?:(\d+(?:[.,]\d+)?)(m)?)?$/i;

function estimateToken(token: string): number | undefined {
  const match = estimateSyntax.exec(token);
  if (!match) return undefined;
  const [, days, hours, minutes, unit] = match;
  // Minutes may drop their unit only after hours, as in 1h30.
  if ((days ?? hours ?? minutes) === undefined || (minutes !== undefined && !unit && hours === undefined)) return undefined;
  const amount = (value: string | undefined) => Number((value ?? "0").replace(",", "."));
  const total = amount(days) * HOURS_PER_UNIT.days + amount(hours) + amount(minutes) * HOURS_PER_UNIT.minutes;
  const parsed = durationHoursSchema.safeParse(total);
  return parsed.success ? parsed.data ?? undefined : undefined;
}

function projectToken(name: string, projects: readonly Project[]): string | undefined {
  const key = wordKey(name);
  const matches = projects.filter((project) => wordKey(project.name.replace(/\s+/gu, "-")) === key);
  // Two saved names can differ only in accents or in how their spaces are written.
  return matches.length === 1 ? matches[0].id : undefined;
}

export function partOfDayAt(time: string): PartOfDay {
  const hour = Number(time.slice(0, 2));
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

/**
 * Reads one task. A token is a whole word; a leading backslash keeps it as text.
 * It never throws and reads no clock: invalid dates and unknown +projects stay in the title and are reported.
 */
export function parseQuickAdd(text: string, context: QuickAddContext): QuickAddResult {
  const today = z.iso.date().safeParse(context.today).success ? context.today : "";
  const projects = context.projects ?? [];
  const literals = new Map<string, number>();
  for (const word of context.literals ?? []) literals.set(word, (literals.get(word) ?? 0) + 1);
  const words = [...text.matchAll(/\S+/gu)].map((match) => ({ raw: match[0], start: match.index, end: match.index + match[0].length }));
  const title: string[] = [];
  const tags = new Set<string>();
  const tokens: QuickToken[] = [];
  const warnings: QuickWarning[] = [];
  let project: string | null = null;
  let due: string | null = null;
  let time: string | null = null;
  let priority: Priority | null = null;
  let estimate: number | null = null;
  const mark = (type: QuickTokenType, value: string | number, start: number, end: number) => { tokens.push({ type, value, start, end }); };

  for (let index = 0; index < words.length; index++) {
    const { raw, start, end } = words[index];
    const kept = literals.get(raw) ?? 0;
    if (kept > 0) { literals.set(raw, kept - 1); title.push(raw); continue; }
    if (raw.startsWith("\\")) {
      const literal = raw.slice(1);
      title.push(/^[#@+!~]/.test(literal) || isDateWord(literal) || estimateToken(literal) !== undefined ? literal : raw);
      continue;
    }
    const tag = tagToken(raw);
    const level = priorityToken(raw);
    if (tag) { tags.add(tag); mark("tag", tag, start, end); continue; }
    if (level) { priority = level; mark("priority", level, start, end); continue; }
    if (raw.length > 1 && (raw[0] === "@" || raw[0] === "+")) {
      const id = projectToken(raw.slice(1), projects);
      if (id) { project = id; mark("project", id, start, end); continue; }
      const expression = raw[0] === "@" && today ? dueExpression(raw.slice(1), today) : undefined;
      if (expression) {
        const following = expression.date && !expression.time ? words[index + 1] : undefined;
        const clock = following ? clockTime(following.raw) : undefined;
        // A time on its own refines the day already typed instead of moving it to today.
        due = expression.date ?? due ?? today;
        time = expression.date ? clock ?? null : expression.time;
        mark("due", due, start, clock && following ? following.end : end);
        if (clock) index++;
        continue;
      }
      if (expression === null || (raw[0] === "+" && /^\+\p{L}/u.test(raw))) {
        warnings.push({ kind: raw[0] === "+" ? "project" : "date", text: raw, start, end });
      }
      title.push(raw);
      continue;
    }
    const date = today ? dateWord(raw, today) : undefined;
    if (date) { due = date; time = null; mark("due", date, start, end); continue; }
    if (date === null) { warnings.push({ kind: "date", text: raw, start, end, fatal: true }); title.push(raw); continue; }
    const hours = estimateToken(raw);
    if (hours !== undefined) { estimate = hours; mark("estimate", hours, start, end); continue; }
    title.push(raw);
  }
  return { title: title.join(" "), tags: [...tags], project, due, time, priority, estimate, tokens, warnings };
}

function eachLine<T extends { start: number; end: number }>(text: string, read: (line: string) => T[]): T[] {
  let offset = 0;
  return text.split("\n").flatMap((line) => {
    const start = offset;
    offset += line.length + 1;
    return read(line).map((item) => ({ ...item, start: item.start + start, end: item.end + start }));
  });
}

/** Tokens of every line, positioned in the whole text. A token never crosses a line. */
export function quickTextTokens(text: string, context: QuickAddContext): QuickToken[] {
  return eachLine(text, (line) => parseQuickAdd(line, context).tokens);
}

export function quickTextWarnings(text: string, context: QuickAddContext): QuickWarning[] {
  return eachLine(text, (line) => parseQuickAdd(line, context).warnings);
}

export function stripQuickTokens(text: string, context: QuickAddContext, type: QuickTokenType, value?: string): string {
  const matching = quickTextTokens(text, context).filter((token) => token.type === type && (value === undefined || token.value === value));
  return matching.reduceRight((current, { start, end }) => {
    const before = current.slice(0, start);
    const after = current.slice(end);
    // Take one neighbouring space with the token so the text stays tidy.
    return /[^\S\n]$/.test(before) && !/^[^\s]/.test(after) ? before.slice(0, -1) + after : before + after.replace(/^[^\S\n]/, "");
  }, text);
}

/** The validated task for one line. Throws when the line cannot be saved. */
export function parseQuickTask(text: string, today: string, projects: readonly Project[] = []): QuickTask {
  const parsed = quickAddInputSchema.parse({ text, today });
  const result = parseQuickAdd(parsed.text, { today: parsed.today, projects });
  // Refuse calendar overflow instead of silently dropping a recognized shortcut.
  if (result.warnings.some((warning) => warning.fatal)) throw new Error("date_out_of_range");
  return quickTaskSchema.parse({
    title: result.title, tags: result.tags, due: result.due,
    ...(result.priority ? { priority: result.priority } : {}), ...(result.project ? { projectId: result.project } : {}),
    ...(result.estimate === null ? {} : { estimateHours: result.estimate }),
    // The deadline stores a day; the hour survives as its part of the day.
    ...(result.time ? { partOfDay: partOfDayAt(result.time) } : {}),
  });
}

/**
 * Applies the syntax to a title being edited. Words the saved title already had stay text,
 * so a title such as "Call Ana tomorrow" is never reinterpreted.
 */
export function parseQuickEdit(original: string, edited: string, context: QuickAddContext): QuickEdit {
  const result = parseQuickAdd(edited, { ...context, literals: original.split(/\s+/u).filter(Boolean) });
  return {
    title: result.title,
    changes: {
      ...(result.tags.length ? { tags: result.tags } : {}),
      ...(result.priority ? { priority: result.priority } : {}),
      ...(result.due ? { due: result.due } : {}),
      ...(result.time ? { partOfDay: partOfDayAt(result.time) } : {}),
      ...(result.project ? { projectId: result.project } : {}),
      ...(result.estimate === null ? {} : { estimateHours: result.estimate }),
    },
  };
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
      const estimateHours = task.estimateHours ?? defaults.estimateHours;
      const tagsByKey = new Map([...task.tags, ...(defaults.tags ?? [])].map((tag) => [normalizeQuickTag(tag), normalizeQuickTag(tag)]));
      if (defaults.tag) tagsByKey.set(normalizeQuickTag(defaults.tag), defaults.tag);
      const tags = [...tagsByKey.values()].filter(Boolean);
      return quickTaskSchema.parse({
        ...task, tags, due: task.due ?? defaults.due ?? null,
        projectId: task.projectId ?? defaults.projectId ?? null,
        ...(priority ? { priority } : {}), ...(defaults.plannedFor ? { plannedFor: defaults.plannedFor } : {}),
        ...(estimateHours == null ? {} : { estimateHours }),
      });
    } catch (error) {
      const tagLimit = error instanceof z.ZodError && error.issues.some((issue) => issue.path[0] === "tags");
      throw new QuickDraftError({ kind: tagLimit ? "tag_limit" : "line_invalid", line: index + 1 });
    }
  });
}
