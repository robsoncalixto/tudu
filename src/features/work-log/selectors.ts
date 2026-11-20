import type { Task } from "@/features/tasks/schema";
import type { Project } from "@/features/projects/schema";
import { dateInTimeZone } from "@/lib/dates";
import { workLogQuerySchema, type Grouping, type WorkLogGroup, type WorkLogQuery } from "./schema";

export function completedOn(tasks: Task[], query: WorkLogQuery): Task[] {
  if (!workLogQuerySchema.safeParse(query).success) return [];
  return tasks.filter((task) => {
    return task.done && task.completedAt && dateInTimeZone(task.completedAt, query.timeZone) === query.day;
  }).sort((a, b) => Date.parse(a.completedAt!) - Date.parse(b.completedAt!) || a.id.localeCompare(b.id));
}

export function groupWorkLog(tasks: Task[], projects: Project[], kind: Grouping): WorkLogGroup[] {
  const groups = new Map<string, WorkLogGroup>();
  for (const task of tasks) {
    const labels = kind === "none" ? [null] : kind === "project"
      ? [projects.find((project) => project.id === task.projectId)?.name ?? null]
      : task.tags.length ? [...new Set(task.tags)] : [null];
    for (const label of labels) {
      const key = label === null ? "unassigned" : `label:${label}`;
      const group = groups.get(key) ?? { key, kind, label, tasks: [] };
      group.tasks.push(task);
      groups.set(key, group);
    }
  }
  return [...groups.values()].sort((a, b) => a.label === null ? 1 : b.label === null ? -1 : a.label.localeCompare(b.label));
}

export interface WorkLogTime {
  hours: number;
  missing: number;
}

export function totalWorkLogTime(tasks: Task[]): WorkLogTime {
  const unique = new Map(tasks.map((task) => [task.id, task]));
  let hours = 0;
  let missing = 0;
  for (const { realTimeHours } of unique.values()) {
    if (realTimeHours === null) missing++;
    else hours += realTimeHours;
  }
  return { hours, missing };
}
