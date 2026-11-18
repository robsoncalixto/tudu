import { durationHoursSchema, type DurationDraft, type DurationUnit } from "./schema";

const HOURS_PER_UNIT: Record<DurationUnit, number> = { minutes: 1 / 60, hours: 1, days: 12 };

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
