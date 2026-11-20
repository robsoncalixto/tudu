import { rankDayTasks } from "./day-order";
import { calendarDayOrNull } from "@/lib/dates";
import type { Task } from "./schema";
import type { Project } from "@/features/projects/schema";

import type { TaskFilter, TaskSort } from "./board-navigation";
export type { TaskFilter, TaskSort } from "./board-navigation";

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

export function isPlannedForToday(task: Task, today: string): boolean {
  const plan = calendarDayOrNull(task.plannedFor);
  return Boolean(today) && plan !== null && (plan === today || (!task.done && plan < today));
}

export function isForToday(task: Task, today: string): boolean {
  const due = calendarDayOrNull(task.due);
  return Boolean(today) && (isPlannedForToday(task, today) || (due !== null && due <= today));
}

function searchText(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Earliest due date first (undated last), then priority, then oldest. */
function byUrgency(a: Task, b: Task): number {
  const aDue = calendarDayOrNull(a.due);
  const bDue = calendarDayOrNull(b.due);
  if (aDue !== bDue) {
    if (aDue === null) return 1;
    if (bDue === null) return -1;
    return aDue < bDue ? -1 : 1;
  }
  if (a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  return a.createdAt.localeCompare(b.createdAt);
}

export interface TaskView {
  open: Task[];
  done: Task[];
  /** Open tasks across all tags, ignoring the filter. */
  openCount: number;
  todayCount: number;
  scopeOpen: number;
  scopeDone: number;
  /** Tags on open tasks with how many open tasks carry each, sorted by name. */
  tagCounts: [tag: string, count: number][];
  projectCounts: [project: Project, count: number][];
}

export function buildTaskView(tasks: Task[], filter: TaskFilter, today: string = "", projects: Project[] = [], query = "", sort: TaskSort = "due"): TaskView {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (task.done) continue;
    for (const tag of task.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const words = searchText(query).trim().split(/\s+/u).filter(Boolean);
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const scope = tasks.filter((task) => {
    if (filter.kind === "today") return isForToday(task, today);
    if (filter.kind === "tag") return task.tags.includes(filter.tag);
    if (filter.kind === "project") return task.projectId === filter.id;
    return true;
  });
  const scopeOpen = scope.filter((task) => !task.done).length;
  const visible = words.length ? scope.filter((task) => {
    const content = searchText([task.title, task.notes, ...task.tags.map((tag) => `#${tag}`),
      projectNames.get(task.projectId ?? ""), ...task.steps.map((step) => step.title)].join(" "));
    return words.every((word) => content.includes(word));
  }) : scope;
  const open = visible.filter((task) => !task.done);
  return {
    open: sort === "manual" && filter.kind === "today" ? rankDayTasks(open, today) : open.sort((a, b) => {
      if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "priority" && a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      return byUrgency(a, b);
    }),
    done: visible
      .filter((task) => task.done)
      .sort((a, b) => ((a.completedAt ?? "") < (b.completedAt ?? "") ? 1 : -1)),
    openCount: tasks.filter((task) => !task.done).length,
    scopeOpen,
    scopeDone: scope.length - scopeOpen,
    todayCount: tasks.filter((task) => !task.done && isForToday(task, today)).length,
    tagCounts: [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    projectCounts: [...projects].sort((a, b) => a.name.localeCompare(b.name)).map((project) => [
      project, tasks.filter((task) => !task.done && task.projectId === project.id).length,
    ]),
  };
}
