import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { taskSchema, type Task, type TaskInput, type TaskPatch } from "../schema";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "tasks.json");

// Every read-modify-write goes through one queue so concurrent requests
// cannot overwrite each other's changes. Kept on globalThis because the dev
// server may load this module more than once.
const state = globalThis as typeof globalThis & { __tuduQueue?: Promise<unknown> };

function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = (state.__tuduQueue ?? Promise.resolve()).then(fn, fn);
  state.__tuduQueue = run.catch(() => undefined);
  return run;
}

async function read(): Promise<Task[]> {
  try {
    return z.array(taskSchema).parse(JSON.parse(await fs.readFile(FILE, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function write(tasks: Task[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(tasks, null, 2), "utf8");
  await fs.rename(tmp, FILE);
}

export function listTasks(): Promise<Task[]> {
  return locked(read);
}

export function addTasks(inputs: TaskInput[]): Promise<Task[]> {
  return locked(async () => {
    const tasks = await read();
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
    await write([...tasks, ...created]);
    return created;
  });
}

export function updateTask(id: string, patch: TaskPatch): Promise<Task | null> {
  return locked(async () => {
    const tasks = await read();
    const index = tasks.findIndex((task) => task.id === id);
    if (index === -1) return null;
    const current = tasks[index];
    const next: Task = { ...current, ...patch };
    if (patch.done !== undefined && patch.done !== current.done) {
      next.completedAt = patch.done ? new Date().toISOString() : null;
    }
    tasks[index] = next;
    await write(tasks);
    return next;
  });
}

export function deleteTask(id: string): Promise<boolean> {
  return locked(async () => {
    const tasks = await read();
    const remaining = tasks.filter((task) => task.id !== id);
    if (remaining.length === tasks.length) return false;
    await write(remaining);
    return true;
  });
}
