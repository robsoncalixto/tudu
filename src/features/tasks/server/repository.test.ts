import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskInput } from "../schema";
import { createJsonStore } from "./json-store";
import { connectPostgres, createPostgresStore } from "./postgres-store";
import { createRepository } from "./repository";

type Repository = ReturnType<typeof createRepository>;

const input = (title: string): TaskInput => ({ title, notes: "", priority: "medium", due: null, tags: [] });

interface Backend {
  name: string;
  open(): Promise<{ repo: Repository; close(): Promise<void> }>;
}

const backends: Backend[] = [
  {
    name: "JSON file",
    async open() {
      const dir = await mkdtemp(path.join(tmpdir(), "tudu-test-"));
      return {
        repo: createRepository(createJsonStore(dir)),
        close: () => rm(dir, { recursive: true, force: true }),
      };
    },
  },
  {
    // PGlite is real Postgres compiled to WebAssembly, so the SQL is checked
    // without a database server.
    name: "Postgres (PGlite)",
    async open() {
      const db = new PGlite();
      return { repo: createRepository(createPostgresStore(db)), close: () => db.close() };
    },
  },
];

// Set TEST_DATABASE_URL to also run against a real server. Its tables are
// dropped before every test, so point it at a throwaway database.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl) {
  if (!/test|e2e/i.test(new URL(testDatabaseUrl).pathname)) {
    throw new Error("TEST_DATABASE_URL must name a throwaway database (its name must contain 'test' or 'e2e').");
  }
  backends.push({
    name: "Postgres (server)",
    async open() {
      const sql = connectPostgres(testDatabaseUrl);
      await sql.query("DROP TABLE IF EXISTS tasks, tudu_migrations");
      return { repo: createRepository(createPostgresStore(sql)), close: async () => undefined };
    },
  });
}

describe.each(backends)("repository on $name", (backend) => {
  let repo: Repository;
  let close: () => Promise<void>;

  beforeEach(async () => {
    ({ repo, close } = await backend.open());
  });

  afterEach(() => close());

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

  it("stores every field exactly as given", async () => {
    const [created] = await repo.addTasks([
      { title: "Plan Q1", notes: "Ask Ana", priority: "high", due: "2026-11-30", tags: ["work", "q1"] },
    ]);
    expect(await repo.listTasks()).toEqual([created]);
  });

  it("lists tasks in the order they were added", async () => {
    await repo.addTasks([input("a"), input("b")]);
    await repo.addTasks([input("c")]);
    expect((await repo.listTasks()).map((task) => task.title)).toEqual(["a", "b", "c"]);
  });

  it("saves every field of an update", async () => {
    const [task] = await repo.addTasks([input("a")]);
    const updated = await repo.updateTask(task.id, {
      title: "b",
      notes: "n",
      priority: "low",
      due: "2026-12-01",
      tags: ["x"],
    });
    expect(updated).toMatchObject({ title: "b", notes: "n", priority: "low", due: "2026-12-01", tags: ["x"] });
    expect(await repo.listTasks()).toEqual([updated]);
    expect(await repo.updateTask(task.id, { due: null, tags: [] })).toMatchObject({ due: null, tags: [] });
  });

  it("sets and clears completedAt when done changes", async () => {
    const [task] = await repo.addTasks([input("a")]);
    const done = await repo.updateTask(task.id, { done: true });
    expect(done?.completedAt).not.toBeNull();
    expect(await repo.listTasks()).toEqual([done]);
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

  it("does not lose updates when requests overlap", async () => {
    const [task] = await repo.addTasks([input("a")]);
    await Promise.all([
      repo.updateTask(task.id, { title: "renamed" }),
      repo.updateTask(task.id, { priority: "high" }),
      repo.updateTask(task.id, { done: true }),
    ]);
    expect(await repo.listTasks()).toMatchObject([{ title: "renamed", priority: "high", done: true }]);
  });

  it("saves and clears selections independently of due dates and completion", async () => {
    const [task] = await repo.addTasks([{ ...input("Plan"), due: "2026-11-16" }]);
    expect(task.plannedFor).toBeNull();
    await repo.updateTask(task.id, { plannedFor: "2026-11-17" });
    await repo.updateTask(task.id, { done: true });
    expect((await repo.listTasks())[0]).toMatchObject({
      plannedFor: "2026-11-17", done: true, due: "2026-11-16",
    });
    await repo.updateTask(task.id, { plannedFor: null });
    expect((await repo.listTasks())[0]).toMatchObject({ plannedFor: null, due: "2026-11-16" });
  });
});

describe("default repository", () => {
  let dir: string;

  // The storage choice is read when the module loads, so each test sets the
  // environment and imports a fresh copy.
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "tudu-test-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("DATABASE_URL", "");
    vi.resetModules();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("uses tasks.json without DATABASE_URL and leaves no temporary files behind", async () => {
    const repo = await import("./repository");
    await repo.addTasks([input("a"), input("b")]);
    expect(await readdir(dir)).toEqual(["tasks.json"]);
    const stored = JSON.parse(await readFile(path.join(dir, "tasks.json"), "utf8"));
    expect(stored.map((task: { title: string }) => task.title)).toEqual(["a", "b"]);
    expect(stored[0].plannedFor).toBeNull();
  });

  it("reads legacy tasks with no selection and preserves them when saving", async () => {
    const repo = await import("./repository");
    const legacy = {
      ...input("Existing"), id: "old", done: false,
      createdAt: "2026-11-01T12:00:00.000Z", completedAt: null,
    };
    await writeFile(path.join(dir, "tasks.json"), JSON.stringify([legacy]));
    expect(await repo.listTasks()).toEqual([{ ...legacy, plannedFor: null }]);
    await repo.updateTask("old", { plannedFor: "2026-11-17" });
    expect(await repo.listTasks()).toEqual([{ ...legacy, plannedFor: "2026-11-17" }]);
  });
});
