import type { Project } from "@/features/projects/schema";
import { PRIORITIES, type Priority } from "@/features/tasks/schema";
import { dueExpression, wordKey } from "./due-words";
import { parseQuickAdd } from "./parser";
import {
  normalizeQuickTag, QUICK_TRIGGERS,
  type QuickAddContext, type QuickCompletion, type QuickLanguage, type QuickSuggestion, type SuggestionSources,
} from "./schema";

/** The token being typed at the caret: a trigger at the start of a word, with the caret at the word's end. */
export function completionAt(text: string, caret: number): QuickCompletion | null {
  if (caret < text.length && /\S/u.test(text[caret])) return null;
  const start = text.slice(0, caret).search(/\S+$/u);
  if (start === -1) return null;
  const word = text.slice(start, caret);
  const trigger = QUICK_TRIGGERS.find((item) => item === word[0]);
  return trigger ? { trigger, query: word.slice(1), start, end: caret } : null;
}

/** True when the typed word already means what the suggestion would write, so there is nothing to complete. */
export function isTyped(word: string, suggestion: QuickSuggestion, context: QuickAddContext): boolean {
  const [token] = parseQuickAdd(word, context).tokens;
  return token !== undefined && token.type === (suggestion.kind === "create" ? "tag" : suggestion.kind) && String(token.value) === suggestion.value;
}

const LIMIT = 7;
const DAY_WORDS = {
  en: { relative: ["today", "tomorrow"], weekdays: ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] },
  "pt-BR": { relative: ["hoje", "amanhã"], weekdays: ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] },
} as const satisfies Record<QuickLanguage, unknown>;
const PRIORITY_WORDS: Record<QuickLanguage, Record<Priority, string>> = {
  en: { high: "high", medium: "medium", low: "low" },
  "pt-BR": { high: "alta", medium: "média", low: "baixa" },
};
const PRIORITY_NUMBER: Record<Priority, string> = { high: "1", medium: "2", low: "3" };
const projectWord = (name: string) => name.trim().replace(/\s+/gu, "-").toLowerCase();

function projectSuggestions(trigger: "+" | "@", query: string, projects: readonly Project[]): QuickSuggestion[] {
  const words = projects.map((project) => projectWord(project.name));
  return projects.flatMap((project, index) => {
    const word = words[index];
    // A name shared by two projects cannot be typed, so it is not offered.
    const unique = words.filter((other) => wordKey(other) === wordKey(word)).length === 1;
    return unique && wordKey(word).includes(query) ? [{ kind: "project" as const, insert: trigger + word, label: project.name, value: project.id }] : [];
  }).sort((a, b) => a.label.localeCompare(b.label));
}

function dueSuggestions(query: string, { today, language }: SuggestionSources): QuickSuggestion[] {
  if (!today) return [];
  if (/^\d/u.test(query)) {
    const typed = dueExpression(query, today);
    return typed ? [{ kind: "due", insert: `@${query}`, label: `@${query}`, value: typed.date ?? today, ...(typed.time ? { time: typed.time } : {}) }] : [];
  }
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const upcoming = Array.from({ length: 7 }, (_, offset) => (weekday + 2 + offset) % 7);
  const words = (from: QuickLanguage) => [...DAY_WORDS[from].relative, ...upcoming.map((day) => DAY_WORDS[from].weekdays[day])];
  // The interface language comes first; the other language is still understood when typed.
  const order: QuickLanguage[] = language === "en" ? ["en", "pt-BR"] : ["pt-BR", "en"];
  for (const from of order) {
    const matches = words(from).flatMap((word) => {
      const date = wordKey(word).startsWith(query) ? dueExpression(word, today)?.date : null;
      return date ? [{ kind: "due" as const, insert: `@${word}`, label: word, value: date }] : [];
    });
    if (matches.length) return matches;
  }
  return [];
}

/** What can complete the token being typed. Only saved projects are offered; a new tag can be created. */
export function quickSuggestions({ trigger, query }: QuickCompletion, sources: SuggestionSources, used: readonly string[] = []): QuickSuggestion[] {
  const key = wordKey(query);
  if (trigger === "+") return projectSuggestions("+", key, sources.projects).slice(0, LIMIT);
  if (trigger === "@") return [...dueSuggestions(key, sources), ...(key ? projectSuggestions("@", key, sources.projects) : [])].slice(0, LIMIT);
  if (trigger === "!") {
    return [...PRIORITIES].reverse().flatMap((priority) => {
      const words = [...Object.values(PRIORITY_WORDS).map((names) => wordKey(names[priority])), PRIORITY_NUMBER[priority]];
      const word = PRIORITY_WORDS[sources.language][priority];
      return words.some((item) => item.startsWith(key)) ? [{ kind: "priority" as const, insert: `!${word}`, label: priority, value: priority }] : [];
    });
  }
  const typed = normalizeQuickTag(query);
  // The word being typed is already one of the draft's tags; only the others are taken.
  const taken = used.filter((tag) => tag !== typed);
  const matches = sources.tags.filter((tag) => !taken.includes(tag) && wordKey(tag).includes(key))
    .sort((a, b) => Number(wordKey(b).startsWith(key)) - Number(wordKey(a).startsWith(key)))
    .map((tag) => ({ kind: "tag" as const, insert: `#${tag}`, label: tag, value: tag }));
  const creatable = /^[\p{L}\p{N}_-]{1,40}$/u.test(typed) && !sources.tags.includes(typed) && !taken.includes(typed);
  return [...matches.slice(0, creatable ? LIMIT - 1 : LIMIT), ...(creatable ? [{ kind: "create" as const, insert: `#${typed}`, label: typed, value: typed }] : [])];
}
