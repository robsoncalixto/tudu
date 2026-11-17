import type { Task } from "../schema";

/**
 * Where tasks are kept. The repository holds the rules (ids, timestamps,
 * completion); a store only saves and loads, so each backend stays small.
 */
export interface TaskStore {
  /** Every task, oldest first. */
  list(): Promise<Task[]>;
  insert(tasks: Task[]): Promise<void>;
  /** Applies `change` to the task atomically; null when it does not exist. */
  modify(id: string, change: (task: Task) => Task): Promise<Task | null>;
  remove(id: string): Promise<boolean>;
  clearProject(id: string): Promise<void>;
}
