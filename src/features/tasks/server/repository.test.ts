import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskInput } from "../schema";

type Repository = typeof import("./repository");

const input = (title: string): TaskInput => ({ title, notes: "", priority: "medium", due: null, tags: [] });

let dir: string;
let repo: Repository;

// The data directory is read when the module loads, so each test points
// DATA_DIR at a fresh folder and imports a fresh copy.
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "tudu-test-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.resetModules();
  repo = await import("./repository");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe("repository", () => {
  it("returns an empty list before anything is saved", async () => {
    expect(await repo.listTasks()).toEqual([]);
  });

  it("creates tasks with an id, open state and timestamps", async () => {
    const [created] = await repo.addTasks([input("Write report")]);
    expect(created).toMatchObject({ title: "Write report", done: false, completedAt: null });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false);
    expect(await repo.listTasks()).toEqual([created]);
  });

  it("persists to tasks.json and leaves no temporary files behind", async () => {
    await repo.addTasks([input("a"), input("b")]);
    expect(await readdir(dir)).toEqual(["tasks.json"]);
    const stored = JSON.parse(await readFile(path.join(dir, "tasks.json"), "utf8"));
    expect(stored.map((task: { title: string }) => task.title)).toEqual(["a", "b"]);
  });

  it("sets and clears completedAt when done changes", async () => {
    const [task] = await repo.addTasks([input("a")]);
    const done = await repo.updateTask(task.id, { done: true });
    expect(done?.completedAt).not.toBeNull();
    const reopened = await repo.updateTask(task.id, { done: false });
    expect(reopened?.completedAt).toBeNull();
  });

  it("keeps completedAt when an already-done task is edited", async () => {
    const [task] = await repo.addTasks([input("a")]);
    const done = await repo.updateTask(task.id, { done: true });
    const renamed = await repo.updateTask(task.id, { title: "b", done: true });
    expect(renamed).toMatchObject({ title: "b", completedAt: done?.completedAt });
  });

  it("returns null when updating a task that does not exist", async () => {
    expect(await repo.updateTask("missing", { title: "x" })).toBeNull();
  });

  it("deletes a task and reports whether it existed", async () => {
    const [first, second] = await repo.addTasks([input("a"), input("b")]);
    expect(await repo.deleteTask(first.id)).toBe(true);
    expect(await repo.deleteTask(first.id)).toBe(false);
    expect(await repo.listTasks()).toEqual([second]);
  });

  it("does not lose writes when requests overlap", async () => {
    await Promise.all(Array.from({ length: 25 }, (_, index) => repo.addTasks([input(`task ${index}`)])));
    const tasks = await repo.listTasks();
    expect(tasks).toHaveLength(25);
    expect(new Set(tasks.map((task) => task.id)).size).toBe(25);
  });
});
