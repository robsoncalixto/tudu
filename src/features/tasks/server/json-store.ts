import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { storedTaskSchema, type Task } from "../schema";
import type { TaskStore } from "./store";

// Every read-modify-write goes through one queue so concurrent requests
// cannot overwrite each other's changes. Kept on globalThis because the dev
// server may load this module more than once.
const state = globalThis as typeof globalThis & { __tuduQueue?: Promise<unknown> };

function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = (state.__tuduQueue ?? Promise.resolve()).then(fn, fn);
  state.__tuduQueue = run.catch(() => undefined);
  return run;
}

/** Keeps every task in `<dataDir>/tasks.json`, written atomically. */
export function createJsonStore(dataDir: string): TaskStore {
  const file = path.join(dataDir, "tasks.json");

  async function read(): Promise<Task[]> {
    try {
      return z.array(storedTaskSchema).parse(JSON.parse(await fs.readFile(file, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async function write(tasks: Task[]): Promise<void> {
    await fs.mkdir(dataDir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(tasks, null, 2), "utf8");
    await fs.rename(tmp, file);
  }

  return {
    list: () => locked(read),
    changeOrder: (change) => locked(async () => {
      const tasks = await read();
      const updates = new Map(change(tasks).map((task) => [task.id, task]));
      await write(tasks.map((task) => updates.get(task.id) ?? task));
    }),
    clearProject: (id) => locked(async () => {
      await write((await read()).map((task) => task.projectId === id ? { ...task, projectId: null } : task));
    }),

    insert: (created) =>
      locked(async () => {
        const tasks = await read();
        const ids = new Set(tasks.map((task) => task.id));
        for (const task of created) {
          if (!ids.has(task.id)) { tasks.push(task); ids.add(task.id); }
        }
        await write(tasks);
      }),

    modify: (id, change) =>
      locked(async () => {
        const tasks = await read();
        const index = tasks.findIndex((task) => task.id === id);
        if (index === -1) return null;
        const next = change(tasks[index]);
        tasks[index] = next.task;
        if (next.nextTask) tasks.push(next.nextTask);
        await write(tasks);
        return { task: next.task, nextTask: tasks.find((task) => task.id === next.task.nextOccurrenceId) ?? null };
      }),

    remove: (id) =>
      locked(async () => {
        const tasks = await read();
        const remaining = tasks.filter((task) => task.id !== id);
        if (remaining.length === tasks.length) return false;
        await write(remaining);
        return true;
      }),
  };
}
