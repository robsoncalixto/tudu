import { randomUUID } from "node:crypto";
import path from "node:path";
import { taskSchema, type Task, type TaskCreationInput, type TaskInput, type TaskPatch, type TaskUpdate } from "../schema";
import { nextDueDate, validateRepeat } from "../recurrence";
import { createJsonStore } from "./json-store";
import { connectPostgres, createPostgresStore } from "./postgres-store";
import type { TaskStore } from "./store";

export class TaskChangedError extends Error {}

/** The rules every backend shares: new tasks start open, completion is stamped. */
export function createRepository(store: TaskStore) {
  function updateTaskWithNext(id: string, patch: TaskPatch, expected?: Task): Promise<TaskUpdate | null> {
    return store.modify(id, (current) => {
      if (expected && JSON.stringify(taskSchema.parse(current)) !== JSON.stringify(taskSchema.parse(expected))) throw new TaskChangedError();
      const task: Task = { ...current, ...patch };
      validateRepeat(task.due, task.repeat);
      const completing = !current.done && task.done;
      if (task.done !== current.done) task.completedAt = task.done ? new Date().toISOString() : null;
      let nextTask: Task | null = null;
      // The link survives reopening or deleting the child, so retries cannot branch a series.
      if (completing && task.repeat && task.due && !task.nextOccurrenceId) {
        nextTask = taskSchema.parse({
          ...task, id: randomUUID(), due: nextDueDate(task.due, task.repeat),
          done: false, completedAt: null, createdAt: task.completedAt, plannedFor: null,
          realTimeHours: null,
          steps: task.steps.map((step) => ({ ...step, done: false })), nextOccurrenceId: null,
        });
        task.nextOccurrenceId = nextTask.id;
      }
      return { task, nextTask };
    });
  }
  return {
    listTasks(): Promise<Task[]> {
      return store.list();
    },

    async addTasks(inputs: TaskCreationInput[]): Promise<Task[]> {
      const now = new Date().toISOString();
      const created = inputs.map((input) => {
        validateRepeat(input.due, input.repeat);
        return taskSchema.parse({
          ...input,
          id: randomUUID(),
          done: false,
          createdAt: now,
          completedAt: null,
        });
      });
      await store.insert(created);
      return created;
    },

    async addApprovedTask(id: string, input: TaskInput, plannedFor: string | null): Promise<Task> {
      validateRepeat(input.due, input.repeat);
      const task = taskSchema.parse({ ...input, id, plannedFor, done: false, completedAt: null, createdAt: new Date().toISOString() });
      await store.insert([task]);
      const stored = (await store.list()).find((stored) => stored.id === id);
      if (!stored) throw new Error("Task write could not be confirmed");
      return stored;
    },

    async updateTask(id: string, patch: TaskPatch): Promise<Task | null> {
      return (await updateTaskWithNext(id, patch))?.task ?? null;
    },
    updateTaskWithNext,
    async updateTaskIfUnchanged(id: string, patch: TaskPatch, expected: Task): Promise<Task | null> {
      return (await updateTaskWithNext(id, patch, expected))?.task ?? null;
    },

    deleteTask(id: string): Promise<boolean> {
      return store.remove(id);
    },
    clearTaskProject(id: string): Promise<void> {
      return store.clearProject(id);
    },
  };
}

// Tasks live in a JSON file unless DATABASE_URL points at Postgres. A new
// Postgres database starts with the tasks already in the file.
function defaultStore(): TaskStore {
  const json = createJsonStore(process.env.DATA_DIR ?? path.join(process.cwd(), "data"));
  const url = process.env.DATABASE_URL;
  if (!url) return json;
  return createPostgresStore(connectPostgres(url), { seed: json.list });
}

const repository = createRepository(defaultStore());

export const { listTasks, addTasks, addApprovedTask, updateTask, updateTaskWithNext, updateTaskIfUnchanged, deleteTask, clearTaskProject } = repository;
