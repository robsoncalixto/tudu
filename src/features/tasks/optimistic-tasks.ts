import type { Task, TaskPatch } from "./schema";

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
