import type { RepeatRule } from "@/features/recurrence/schema";
import type { Dictionary, Locale } from "@/i18n";
import { calendarDateSchema, weekdayName } from "@/lib/dates";

export function repeatDescription(repeat: RepeatRule | null, locale: Locale, t: Dictionary): string {
  if (!repeat) return t.repeatFrequencies.never;
  if (repeat.frequency === "monthly") return t.repeatMonthlyDay(repeat.day);
  if (repeat.frequency === "weekly") {
    const days = repeat.days.map((day) => weekdayName(day, locale));
    return `${t.repeatFrequencies.weekly}: ${days.join(", ")}`;
  }
  return t.repeatFrequencies[repeat.frequency];
}

export class InvalidRepeatError extends Error {
  constructor() { super("invalid_repeat"); }
}

export function validateRepeat(due: string | null, repeat: RepeatRule | null): void {
  if (repeat && !calendarDateSchema.safeParse(due).success) throw new InvalidRepeatError();
}

/** Advance from the scheduled date, independent of completion time and timezone. */
export function nextDueDate(due: string, repeat: RepeatRule): string {
  validateRepeat(due, repeat);
  const date = new Date(`${due}T12:00:00Z`);
  if (repeat.frequency === "monthly") {
    for (let month = 0; month < 2; month++) {
      const candidate = new Date(date);
      candidate.setUTCDate(1);
      candidate.setUTCMonth(candidate.getUTCMonth() + month + 1);
      candidate.setUTCDate(0);
      candidate.setUTCDate(Math.min(repeat.day, candidate.getUTCDate()));
      if (candidate > date) return format(candidate);
    }
  } else {
    for (let offset = 1; offset <= 7; offset++) {
      date.setUTCDate(date.getUTCDate() + 1);
      const day = date.getUTCDay();
      if (repeat.frequency === "daily" || (repeat.frequency === "weekdays" && day > 0 && day < 6)
        || (repeat.frequency === "weekly" && repeat.days.includes(day))) return format(date);
    }
  }
  throw new InvalidRepeatError();
}

function format(date: Date): string {
  const value = date.toISOString().slice(0, 10);
  if (!calendarDateSchema.safeParse(value).success) throw new InvalidRepeatError();
  return value;
}
