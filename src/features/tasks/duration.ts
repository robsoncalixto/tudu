import type { Locale } from "@/i18n";
import { HOURS_PER_UNIT, durationHoursSchema, type DurationDraft, type DurationUnit } from "./schema";

export function durationToHours(value: string, unit: DurationUnit) {
  return durationHoursSchema.safeParse(value.trim() === "" ? null : Number(value) * HOURS_PER_UNIT[unit]);
}

export function formatDuration(hours: number | null, unit: DurationUnit): string {
  return hours === null ? "" : Number((hours / HOURS_PER_UNIT[unit]).toPrecision(12)).toString();
}

export function changeDurationUnit(draft: DurationDraft, unit: DurationUnit): DurationDraft {
  const parsed = durationToHours(draft.value, draft.unit);
  if (!parsed.success) return { value: draft.value, unit };
  // Retain the exact duration when a displayed decimal has repeating digits.
  const hours = draft.hours === undefined ? parsed.data : draft.hours;
  return { value: formatDuration(hours, unit), unit, hours };
}

/** A duration in the largest unit that reads naturally: "30 minutes", "2 hours", "1 day". */
export function durationLabel(hours: number, locale: Locale): string {
  const unit: DurationUnit = hours < 1 ? "minutes" : hours % HOURS_PER_UNIT.days === 0 ? "days" : "hours";
  const display = { minutes: "minute", hours: "hour", days: "day" }[unit];
  return new Intl.NumberFormat(locale, { style: "unit", unit: display, unitDisplay: "long", maximumSignificantDigits: 12 })
    .format(hours / HOURS_PER_UNIT[unit]);
}
