import { randomUUID } from "node:crypto";
import path from "node:path";
import { taskSchema, type Task, type TaskInput, type TaskPatch } from "../schema";
import { createJsonStore } from "./json-store";
import { connectPostgres, createPostgresStore } from "./postgres-store";
import type { TaskStore } from "./store";

/** The rules every backend shares: new tasks start open, completion is stamped. */
export function createRepository(store: TaskStore) {
  return {
    listTasks(): Promise<Task[]> {
      return store.list();
    },

    async addTasks(inputs: TaskInput[]): Promise<Task[]> {
      const now = new Date().toISOString();
      const created = inputs.map((input) =>
        taskSchema.parse({
          ...input,
          id: randomUUID(),
          done: false,
          createdAt: now,
          completedAt: null,
        }),
      );
      await store.insert(created);
      return created;
    },

    updateTask(id: string, patch: TaskPatch): Promise<Task | null> {
      return store.modify(id, (current) => {
        const next: Task = { ...current, ...patch };
        if (patch.done !== undefined && patch.done !== current.done) {
          next.completedAt = patch.done ? new Date().toISOString() : null;
        }
        return next;
      });
    },

    deleteTask(id: string): Promise<boolean> {
      return store.remove(id);
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

export const { listTasks, addTasks, updateTask, deleteTask } = repository;
