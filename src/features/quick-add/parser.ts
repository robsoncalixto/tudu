import { z } from "zod";
import { PRIORITIES, type Priority } from "@/features/tasks/schema";
import { quickAddInputSchema, quickTaskSchema, type QuickTask } from "./schema";

const WEEKDAYS: Record<string, number> = {
  sunday: 0, domingo: 0,
  monday: 1, segunda: 1, "segunda-feira": 1,
  tuesday: 2, terca: 2, "terca-feira": 2,
  wednesday: 3, quarta: 3, "quarta-feira": 3,
  thursday: 4, quinta: 4, "quinta-feira": 4,
  friday: 5, sexta: 5, "sexta-feira": 5,
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

/** Shortcuts are separate whitespace-delimited words; no clock or locale is read. */
export function parseQuickTask(text: string, today: string): QuickTask {
  const parsed = quickAddInputSchema.parse({ text, today });
  const title: string[] = [];
  const tags = new Set<string>();
  let priority: Priority | undefined;
  let due: string | null = null;
  for (const token of parsed.text.split(/\s+/u)) {
    if (token.startsWith("\\")) {
      const literal = token.slice(1);
      title.push(tagToken(literal) || priorityToken(literal) || isDateShortcut(literal) ? literal : token);
      continue;
    }
    const tag = tagToken(token);
    const level = priorityToken(token);
    const date = dateToken(token, parsed.today);
    if (tag) tags.add(tag);
    else if (level) priority = level;
    else if (date) due = date;
    else title.push(token);
  }
  return quickTaskSchema.parse({ title: title.join(" "), tags: [...tags], due, ...(priority ? { priority } : {}) });
}
