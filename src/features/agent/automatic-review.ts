import type { Settings } from "@/features/settings/schema";
import { dateInTimeZone } from "@/lib/dates";

export function automaticReviewDay(now: Date, schedule: Settings["automaticReview"], lastRunAt: string | null): string | null {
  if (!schedule.enabled || !schedule.enabledAt || now < new Date(schedule.enabledAt)) return null;
  const nowIso = now.toISOString();
  const day = dateInTimeZone(nowIso, schedule.timeZone)!;
  const lastDay = lastRunAt ? dateInTimeZone(lastRunAt, schedule.timeZone) : null;
  if (lastDay && lastDay >= day) return null;
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: schedule.timeZone, hourCycle: "h23", hour: "2-digit", minute: "2-digit",
  }).format(now);
  if (time >= schedule.time) return day;

  const previous = new Date(`${day}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const yesterday = previous.toISOString().slice(0, 10);
  const enabledDay = dateInTimeZone(schedule.enabledAt, schedule.timeZone)!;
  return enabledDay <= yesterday && (!lastDay || lastDay < yesterday) ? day : null;
}
