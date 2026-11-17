import type { Task } from "./schema";

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

export type TaskFilter = { kind: "all" } | { kind: "today" } | { kind: "tag"; tag: string };

function isForToday(task: Task, today: string): boolean {
  return Boolean(today) && (task.plannedFor === today || (task.due !== null && task.due <= today));
}

/** Earliest due date first (undated last), then priority, then oldest. */
function byUrgency(a: Task, b: Task): number {
  if (a.due !== b.due) {
    if (a.due === null) return 1;
    if (b.due === null) return -1;
    return a.due < b.due ? -1 : 1;
  }
  if (a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  return a.createdAt < b.createdAt ? -1 : 1;
}

export interface TaskView {
  open: Task[];
  done: Task[];
  /** Open tasks across all tags, ignoring the filter. */
  openCount: number;
  todayCount: number;
  /** Tags on open tasks with how many open tasks carry each, sorted by name. */
  tagCounts: [tag: string, count: number][];
}

export function buildTaskView(tasks: Task[], filter: TaskFilter, today: string = ""): TaskView {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (task.done) continue;
    for (const tag of task.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const visible = tasks.filter((task) => {
    if (filter.kind === "today") return isForToday(task, today);
    if (filter.kind === "tag") return task.tags.includes(filter.tag);
    return true;
  });
  return {
    open: visible.filter((task) => !task.done).sort(byUrgency),
    done: visible
      .filter((task) => task.done)
      .sort((a, b) => ((a.completedAt ?? "") < (b.completedAt ?? "") ? 1 : -1)),
    openCount: tasks.filter((task) => !task.done).length,
    todayCount: tasks.filter((task) => !task.done && isForToday(task, today)).length,
    tagCounts: [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  };
}
