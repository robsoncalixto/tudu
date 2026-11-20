import { taskSchema, type Priority, type Task, type TaskDraft, type TaskPatch } from "./schema";

export interface PendingTaskMutation {
  id: string;
  patch: TaskPatch | null;
}

/** The screen includes local edits until each request confirms or rolls back. */
export function applyTaskMutations(confirmed: Task[], pending: PendingTaskMutation[]): Task[] {
  return pending.reduce((visible, { id, patch }) => {
    if (patch === null) return visible.filter((task) => task.id !== id);
    return visible.map((task) => task.id === id ? { ...task, ...patch } : task);
  }, confirmed);
}

const PROVISIONAL = "unsaved-";
let sequence = 0;

/** A task shown the moment it is written, before the server has given it an id. */
export function provisionalTask(draft: TaskDraft, priority: Priority, now: Date): Task {
  return taskSchema.parse({
    ...draft, priority: draft.priority ?? priority, id: `${PROVISIONAL}${now.getTime()}-${sequence++}`,
    done: false, createdAt: now.toISOString(), completedAt: null,
  });
}

/**
 * When a task written now joins the list: never before a task already there. The server stamps it on
 * arrival, so even with two clocks that disagree the row waits where the saved task will be.
 */
export function arrivalTime(tasks: readonly Task[], now: Date): Date {
  const latest = tasks.reduce((time, task) => Math.max(time, Date.parse(task.createdAt), task.planChangedAt ? Date.parse(task.planChangedAt) : 0), 0);
  return new Date(Math.max(now.getTime(), latest + 1));
}

/** Nothing can be saved against a provisional task, so its row stays out of reach until the real one replaces it. */
export function isProvisional(task: Pick<Task, "id">): boolean {
  return task.id.startsWith(PROVISIONAL);
}
