import type { Task } from "./schema";
import { calendarDayOrNull } from "@/lib/dates";

/** Keep the server's slots for tasks that are temporarily absent from the visible list. */
export function orderVisibleDayTasks(saved: string[], visible: string[]): string[] {
  const included = new Set(visible);
  let index = 0;
  return saved.map((id) => included.has(id) ? visible[index++] : id);
}

function arrival(task: Task, day: string) {
  const placed = task.planChangedAt ?? task.createdAt;
  const plan = calendarDayOrNull(task.plannedFor);
  const due = calendarDayOrNull(task.due);
  const carried = plan && plan < day && (!due || due > day);
  return carried ? [placed, `${day}T00:00:00.000Z`].sort()[1] : placed;
}

export function rankDayTasks(tasks: Task[], day: string): Task[] {
  return [...tasks].sort((a, b) => {
    const aRank = a.dayRanks[day];
    const bRank = b.dayRanks[day];
    if (aRank !== undefined || bRank !== undefined) return (aRank ?? Infinity) - (bRank ?? Infinity);
    return arrival(a, day).localeCompare(arrival(b, day));
  });
}

export function moveDayTask(ids: string[], id: string, target: string): string[] {
  const from = ids.indexOf(id);
  const to = ids.indexOf(target);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}
