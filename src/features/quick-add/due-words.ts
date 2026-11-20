import { z } from "zod";

const WEEKDAYS: Record<string, number> = {
  sunday: 0, domingo: 0,
  monday: 1, "segunda-feira": 1,
  tuesday: 2, "terca-feira": 2,
  wednesday: 3, "quarta-feira": 3,
  thursday: 4, "quinta-feira": 4,
  friday: 5, "sexta-feira": 5,
  saturday: 6, sabado: 6,
};
// Short names are ordinary words ("ter", "sex", "sun"), so they only count after an @.
const SHORT_WEEKDAYS: Record<string, number> = {
  sun: 0, dom: 0, mon: 1, seg: 1, segunda: 1, tue: 2, ter: 2, terca: 2, wed: 3, qua: 3, quarta: 3,
  thu: 4, qui: 4, quinta: 4, fri: 5, sex: 5, sexta: 5, sat: 6, sab: 6,
};
const RELATIVE_DAYS: Record<string, number> = { today: 0, hoje: 0, tomorrow: 1, amanha: 1 };

export const wordKey = (token: string) => token.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const isDate = (value: string) => z.iso.date().safeParse(value).success;

function shifted(today: string, days: number): string | null {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  const value = date.toISOString().slice(0, 10);
  return isDate(value) ? value : null;
}

function nextWeekday(today: string, weekday: number): string | null {
  const current = new Date(`${today}T12:00:00Z`).getUTCDay();
  return shifted(today, (weekday - current + 7) % 7 || 7);
}

function relativeDay(word: string, today: string, names: Record<string, number>): string | null | undefined {
  if (Object.hasOwn(RELATIVE_DAYS, word)) return shifted(today, RELATIVE_DAYS[word]);
  if (Object.hasOwn(names, word)) return nextWeekday(today, names[word]);
  return undefined;
}

// "depois de amanhã" and "the day after tomorrow" are one expression that names the following day.
const DAY_AFTER: Record<string, string[][]> = { amanha: [["depois", "de"]], tomorrow: [["the", "day", "after"], ["day", "after"]] };

/** How many of the words written just before a date word turn it into "the day after", longest wording first. */
export function dayAfterLead(word: string, before: readonly string[]): number {
  const leads = Object.hasOwn(DAY_AFTER, wordKey(word)) ? DAY_AFTER[wordKey(word)] : [];
  return leads.find((lead) => lead.length <= before.length && lead.every((item, index) => wordKey(before[before.length - lead.length + index]) === item))?.length ?? 0;
}

export const dayAfter = (date: string): string | null => shifted(date, 1);

export function isDateWord(token: string): boolean {
  const word = wordKey(token);
  return isDate(token) || Object.hasOwn(RELATIVE_DAYS, word) || Object.hasOwn(WEEKDAYS, word);
}

/** A date written as a plain word. `null` means the calendar cannot hold the day it names. */
export function dateWord(token: string, today: string): string | null | undefined {
  if (isDate(token)) return token;
  return relativeDay(wordKey(token), today, WEEKDAYS);
}

/** 14h, 14h30, 14:30, 2pm or 2:30pm as HH:MM. `null` means it reads as a time that does not exist. */
export function clockTime(word: string): string | null | undefined {
  const day = /^(\d{1,2})(?::(\d{2})|h(\d{2})?)$/i.exec(word);
  const half = /^(\d{1,2})(?::(\d{2}))?(am|pm)$/i.exec(word);
  if (!day && !half) return undefined;
  const minute = Number(day ? day[2] ?? day[3] ?? 0 : half?.[2] ?? 0);
  let hour = Number((day ?? half)?.[1]);
  if (half) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (half[3].toLowerCase() === "pm" ? 12 : 0);
  }
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function dayAndMonth(day: number, month: number, year: number | undefined, today: string): string | null {
  const iso = (value: number) => `${String(value).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (year !== undefined) {
    const full = iso(year < 100 ? 2000 + year : year);
    return isDate(full) ? full : null;
  }
  // A day without a year is its next occurrence; eight years reaches the next 29 February.
  const first = Number(today.slice(0, 4));
  for (let offset = 0; offset <= 8; offset++) {
    const candidate = iso(first + offset);
    if (isDate(candidate) && candidate >= today) return candidate;
  }
  return null;
}

export type DueExpression = { date: string | null; time: string | null };

/**
 * What follows an @: a relative day, a weekday, dd/mm, an ISO date or a time.
 * `null` means it was meant as a date but names none; `undefined` means it is not a date at all.
 */
export function dueExpression(body: string, today: string): DueExpression | null | undefined {
  const word = wordKey(body);
  if (/^\d{4}-\d{2}-\d{2}$/.test(word)) return isDate(word) ? { date: word, time: null } : null;
  const calendar = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(word);
  if (calendar) {
    const date = dayAndMonth(Number(calendar[1]), Number(calendar[2]), calendar[3] === undefined ? undefined : Number(calendar[3]), today);
    return date ? { date, time: null } : null;
  }
  const time = clockTime(word);
  if (time !== undefined) return time ? { date: null, time } : null;
  const date = relativeDay(word, today, { ...WEEKDAYS, ...SHORT_WEEKDAYS });
  if (date !== undefined) return date ? { date, time: null } : null;
  return /^\d/.test(word) ? null : undefined;
}
