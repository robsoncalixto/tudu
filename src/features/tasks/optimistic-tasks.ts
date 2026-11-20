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

/** Nothing can be saved against a provisional task, so its row stays out of reach until the real one replaces it. */
export function isProvisional(task: Pick<Task, "id">): boolean {
  return task.id.startsWith(PROVISIONAL);
}
