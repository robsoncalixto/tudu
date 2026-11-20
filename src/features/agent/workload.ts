import type { Settings } from "@/features/settings/schema";
import { PARTS_OF_DAY, type PartOfDay, type Priority, type Task } from "@/features/tasks/schema";

export const DEFAULT_EFFORT = 1;
export type CapacitySettings = Pick<Settings, "workingDays" | "workHoursPerDay">;
type ScheduledTask = Pick<Task, "id" | "done" | "priority" | "plannedFor" | "due" | "partOfDay" | "estimateHours">;

export interface DayWorkload {
  day: string;
  capacity: number;
  hours: number;
  unestimated: number;
  periods: Record<PartOfDay, number>;
}

function calendarDay(start: string, offset: number): string | null {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  const iso = date.toISOString().split("T")[0];
  return iso.length === 10 ? iso : null;
}

export function workloadForDay(tasks: ScheduledTask[], day: string, settings: CapacitySettings): DayWorkload {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  const capacity = settings.workingDays.includes(weekday) ? settings.workHoursPerDay : 0;
  const load: DayWorkload = { day, capacity, hours: 0, unestimated: 0, periods: { morning: 0, afternoon: 0, evening: 0 } };
  for (const task of tasks) {
    if (task.done || (task.plannedFor !== day && task.due !== day)) continue;
    const effort = task.estimateHours ?? DEFAULT_EFFORT;
    load.hours += effort;
    if (task.estimateHours === null) load.unestimated++;
    if (task.partOfDay) load.periods[task.partOfDay] += effort;
  }
  return load;
}

export function upcomingWorkload(tasks: ScheduledTask[], start: string, settings: CapacitySettings, length = 21): DayWorkload[] {
  return Array.from({ length }, (_, offset) => calendarDay(start, offset)).flatMap((day) => day ? [workloadForDay(tasks, day, settings)] : []);
}

export function recommendPlacement(task: { priority: Priority; estimateHours?: number | null }, days: DayWorkload[]) {
  const effort = task.estimateHours ?? DEFAULT_EFFORT;
  const candidates = days.filter((day) => day.capacity - day.hours >= effort);
  const day = (task.priority === "low" ? candidates.find((candidate) => candidate.day !== days[0]?.day) : undefined) ?? candidates[0];
  if (!day) return null;
  const order = task.priority === "high" ? PARTS_OF_DAY : (["afternoon", "morning", "evening"] as const);
  const partOfDay = order.find((period) => day.capacity / PARTS_OF_DAY.length - day.periods[period] >= effort)
    ?? [...order].sort((a, b) => day.periods[a] - day.periods[b])[0];
  return { day: day.day, partOfDay, free: day.capacity - day.hours, effort, usedDefault: task.estimateHours == null || day.unestimated > 0 };
}
