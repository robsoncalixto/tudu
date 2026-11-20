import type { Task } from "@/features/tasks/schema";
import { calendarDayOrNull } from "@/lib/dates";
import type { TaskFilters } from "./schema";

export function filterTasks(tasks: Task[], filter: TaskFilters, isForToday: (task: Task, today: string) => boolean) {
  const matching = tasks.filter((task) => {
    if (filter.state === "open" && task.done || filter.state === "done" && !task.done) return false;
    if (filter.tag !== undefined && !task.tags.includes(filter.tag)) return false;
    if (filter.projectId !== undefined && task.projectId !== filter.projectId) return false;
    if (filter.priority !== undefined && task.priority !== filter.priority) return false;
    const due = calendarDayOrNull(task.due);
    if (filter.dueFrom && (!due || due < filter.dueFrom)) return false;
    if (filter.dueTo && (!due || due > filter.dueTo)) return false;
    if (filter.plannedFor && calendarDayOrNull(task.plannedFor) !== filter.plannedFor) return false;
    if (filter.partOfDay !== undefined && task.partOfDay !== filter.partOfDay) return false;
    if (filter.today && !isForToday(task, filter.today)) return false;
    return !filter.query || `${task.title}\n${task.notes}`.toLowerCase().includes(filter.query.toLowerCase());
  });
  const end = filter.offset + filter.limit;
  return { tasks: matching.slice(filter.offset, end), total: matching.length, nextOffset: end < matching.length ? end : null };
}
