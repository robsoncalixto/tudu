import type { Task } from "@/features/tasks/schema";
import type { TaskFilters } from "./schema";

export function filterTasks(tasks: Task[], filter: TaskFilters) {
  const matching = tasks.filter((task) => {
    if (filter.state === "open" && task.done || filter.state === "done" && !task.done) return false;
    if (filter.tag !== undefined && !task.tags.includes(filter.tag)) return false;
    if (filter.projectId !== undefined && task.projectId !== filter.projectId) return false;
    if (filter.priority !== undefined && task.priority !== filter.priority) return false;
    if (filter.dueFrom && (!task.due || task.due < filter.dueFrom)) return false;
    if (filter.dueTo && (!task.due || task.due > filter.dueTo)) return false;
    if (filter.plannedFor && task.plannedFor !== filter.plannedFor) return false;
    if (filter.today && !(task.plannedFor === filter.today || task.due && task.due <= filter.today)) return false;
    return !filter.query || `${task.title}\n${task.notes}`.toLowerCase().includes(filter.query.toLowerCase());
  });
  const end = filter.offset + filter.limit;
  return { tasks: matching.slice(filter.offset, end), total: matching.length, nextOffset: end < matching.length ? end : null };
}
