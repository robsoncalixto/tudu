import type { Task, TaskUpdate } from "../schema";

/**
 * Where tasks are kept. The repository holds the rules (ids, timestamps,
 * completion); a store only saves and loads, so each backend stays small.
 */
export interface TaskStore {
  /** Every task, oldest first. */
  list(): Promise<Task[]>;
  /** Existing ids are preserved without overwriting, allowing approved creation retries. */
  insert(tasks: Task[]): Promise<void>;
  /** Saves a change and any new occurrence atomically; returns the linked task on retries too. */
  modify(id: string, change: (task: Task) => TaskUpdate): Promise<TaskUpdate | null>;
  changeOrder(change: (tasks: Task[]) => Task[]): Promise<void>;
  remove(id: string): Promise<boolean>;
  clearProject(id: string): Promise<void>;
}
