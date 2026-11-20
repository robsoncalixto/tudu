import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskInput } from "../schema";
import { createJsonStore } from "./json-store";
import { connectPostgres, createPostgresStore } from "./postgres-store";
import { createRepository } from "./repository";

type Repository = ReturnType<typeof createRepository>;

const input = (title: string): TaskInput => ({ title, notes: "", priority: "medium", due: null, tags: [], steps: [], projectId: null, repeat: null });

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

  it("persists a planned day on creation independently of the deadline", async () => {
    const [task] = await repo.addTasks([{ ...input("Review"), plannedFor: "2026-11-17", due: "2026-11-23" }]);
    expect(task).toMatchObject({ plannedFor: "2026-11-17", due: "2026-11-23" });
    expect(await repo.listTasks()).toEqual([task]);
  });

  it("creates an approved id once, preserving an existing task on concurrent retries", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const results = await Promise.all(Array.from({ length: 4 }, () => repo.addApprovedTask(id, input("Approved"), "2026-11-17")));
    expect(await repo.listTasks()).toHaveLength(1);
    expect(results.every((task) => task.id === id && task.plannedFor === "2026-11-17")).toBe(true);
    await repo.updateTask(id, { title: "Human edit" });
    expect((await repo.addApprovedTask(id, input("Do not overwrite"), null)).title).toBe("Human edit");
  });
  it("checks a proposal baseline inside the same transaction as its update", async () => {
    const [task] = await repo.addTasks([input("Original")]);
    const changes = await Promise.allSettled([
      repo.updateTaskIfUnchanged(task.id, { priority: "high" }, task),
      repo.updateTaskIfUnchanged(task.id, { title: "Stale edit" }, task),
    ]);
    expect(changes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(changes.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await repo.listTasks())[0]).toMatchObject({ title: "Original", priority: "high" });
  });

  it("returns an empty list before anything is saved", async () => {
    expect(await repo.listTasks()).toEqual([]);
  });

  it("persists fractional hours for both time fields independently and clears them", async () => {
    const [created] = await repo.addTasks([{ ...input("Timed task"), estimateHours: 1.5, realTimeHours: 1 / 60 }]);
    expect(await repo.listTasks()).toEqual([created]);
    expect(created).toMatchObject({ estimateHours: 1.5, realTimeHours: 1 / 60 });
    await repo.updateTask(created.id, { realTimeHours: 12 });
    expect((await repo.listTasks())[0]).toMatchObject({ estimateHours: 1.5, realTimeHours: 12 });
    await repo.updateTask(created.id, { estimateHours: null, realTimeHours: null });
    expect((await repo.listTasks())[0]).toMatchObject({ estimateHours: null, realTimeHours: null });
  });

  it("keeps the estimate and resets real execution time for the next occurrence", async () => {
    const [created] = await repo.addTasks([{ ...input("Daily report"), due: "2026-11-17", repeat: { frequency: "daily" }, estimateHours: 1.5, realTimeHours: 2 }]);
    const updated = await repo.updateTaskWithNext(created.id, { done: true });
    expect(updated?.task).toMatchObject({ estimateHours: 1.5, realTimeHours: 2 });
    expect(updated?.nextTask).toMatchObject({ estimateHours: 1.5, realTimeHours: null });
    await repo.updateTask(created.id, { done: false });
    expect((await repo.updateTaskWithNext(created.id, { done: true }))?.nextTask?.id).toBe(updated?.nextTask?.id);
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
      { title: "Plan Q1", notes: "Ask Ana", priority: "high", due: "2026-11-30", tags: ["work", "q1"], steps: [], projectId: null, repeat: null },
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
      estimateHours: 1.5,
      links: ["https://example.org/brief"],
    });
    expect(updated).toMatchObject({ title: "b", notes: "n", priority: "low", due: "2026-12-01", tags: ["x"], estimateHours: 1.5, links: ["https://example.org/brief"] });
    expect(await repo.listTasks()).toEqual([updated]);
    expect(await repo.updateTask(task.id, { due: null, tags: [] })).toMatchObject({ due: null, tags: [], steps: [], projectId: null, repeat: null });
    await repo.updateTask(task.id, { links: [], estimateHours: null });
    expect((await repo.listTasks())[0]).toMatchObject({ estimateHours: null, realTimeHours: null, links: [] });
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

  it("persists checklist additions, completion, renaming and removal", async () => {
    const steps = [{ id: "s1", title: "Draft", done: false }, { id: "s2", title: "Review", done: false }];
    const [task] = await repo.addTasks([{ ...input("Report"), steps }]);
    expect((await repo.listTasks())[0].steps).toEqual(steps);
    const changed = [{ ...steps[0], title: "Write draft", done: true }, steps[1]];
    await repo.updateTask(task.id, { steps: changed });
    expect((await repo.listTasks())[0]).toMatchObject({ steps: changed, done: false });
    await repo.updateTask(task.id, { steps: [changed[0]] });
    expect((await repo.listTasks())[0].steps).toEqual([changed[0]]);
    await repo.updateTask(task.id, { steps: [] });
    expect((await repo.listTasks())[0].steps).toEqual([]);
  });
  it("clears a deleted project on open and completed tasks, preserving every other field", async () => {
    const projectId = "00000000-0000-4000-8000-000000000001";
    const otherId = "00000000-0000-4000-8000-000000000002";
    const tasks = await repo.addTasks([
      { ...input("Open"), projectId }, { ...input("Done"), projectId },
      { ...input("Other"), projectId: otherId }, input("None"),
    ]);
    await repo.updateTask(tasks[1].id, { done: true });
    const before = await repo.listTasks();
    await repo.clearTaskProject(projectId);
    expect(await repo.listTasks()).toEqual(before.map((task) => task.projectId === projectId ? { ...task, projectId: null } : task));
    await repo.updateTask(tasks[0].id, { projectId: otherId });
    expect((await repo.listTasks())[0].projectId).toBe(otherId);
    await repo.updateTask(tasks[0].id, { projectId: null });
    expect((await repo.listTasks())[0].projectId).toBeNull();
  });

  it("completes and creates the next occurrence together, copying details and resetting progress", async () => {
    const [task] = await repo.addTasks([{
      ...input("Report"), due: "2026-01-31", repeat: { frequency: "monthly", day: 31 }, notes: "Ask Ana",
      priority: "high", tags: ["work"], projectId: "00000000-0000-4000-8000-000000000001",
      steps: [{ id: "draft", title: "Draft", done: true }],
      estimateHours: 1.5, links: ["https://example.org/report"],
    }]);
    await repo.updateTask(task.id, { plannedFor: "2026-11-17" });
    const result = await repo.updateTaskWithNext(task.id, { done: true });
    expect(result?.task).toMatchObject({ done: true, nextOccurrenceId: result?.nextTask?.id, plannedFor: "2026-11-17" });
    expect(result?.nextTask).toEqual({
      ...task, id: result?.nextTask?.id, due: "2026-02-28", createdAt: result?.task.completedAt,
      steps: [{ id: "draft", title: "Draft", done: false }],
    });
    expect(await repo.listTasks()).toEqual([result?.task, result?.nextTask]);
    const march = await repo.updateTaskWithNext(result!.nextTask!.id, { done: true });
    expect(march?.nextTask?.due).toBe("2026-03-31");
  });

  it("creates only one next occurrence across concurrent requests, retries and reopening", async () => {
    const [task] = await repo.addTasks([{ ...input("Daily"), due: "2026-11-17", repeat: { frequency: "daily" } }]);
    const results = await Promise.all(Array.from({ length: 6 }, () => repo.updateTaskWithNext(task.id, { done: true })));
    expect(new Set(results.map((result) => result?.nextTask?.id)).size).toBe(1);
    expect(await repo.listTasks()).toHaveLength(2);
    const next = results[0]!.nextTask!;
    await repo.updateTask(next.id, { title: "Edited occurrence" });
    expect((await repo.updateTaskWithNext(task.id, { done: true }))?.nextTask?.title).toBe("Edited occurrence");
    await repo.updateTask(task.id, { done: false });
    await repo.updateTask(task.id, { done: true });
    expect(await repo.listTasks()).toHaveLength(2);
    await repo.deleteTask(next.id);
    await repo.updateTask(task.id, { done: false });
    expect((await repo.updateTaskWithNext(task.id, { done: true }))?.nextTask).toBeNull();
    expect(await repo.listTasks()).toHaveLength(1);
  });

  it("uses changed rules and stops repeating after removal without changing existing occurrences", async () => {
    const [task] = await repo.addTasks([{ ...input("Report"), due: "2026-11-20", repeat: { frequency: "daily" } }]);
    await repo.updateTask(task.id, { repeat: { frequency: "weekdays" } });
    const result = await repo.updateTaskWithNext(task.id, { done: true });
    expect(result?.nextTask?.due).toBe("2026-11-23");
    await repo.updateTask(result!.nextTask!.id, { repeat: null, due: null });
    expect((await repo.updateTaskWithNext(result!.nextTask!.id, { done: true }))?.nextTask).toBeNull();
    expect((await repo.listTasks())[0]).toEqual(result?.task);
    expect(await repo.listTasks()).toHaveLength(2);
  });

  it("rolls back invalid repeating dates and batch creation, then accepts a valid retry", async () => {
    const [task] = await repo.addTasks([{ ...input("Report"), due: "2026-11-17", repeat: { frequency: "daily" } }]);
    await expect(repo.updateTask(task.id, { due: null, done: true })).rejects.toThrow("invalid_repeat");
    await expect(repo.updateTask(task.id, { due: "2026-02-30" })).rejects.toThrow("invalid_repeat");
    await expect(repo.addTasks([input("Valid"), { ...input("Bad"), repeat: { frequency: "daily" } }])).rejects.toThrow("invalid_repeat");
    expect(await repo.listTasks()).toEqual([task]);
    await repo.updateTask(task.id, { done: true });
    expect(await repo.listTasks()).toHaveLength(2);
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
  it("keeps completion and its next occurrence unsaved together when the atomic write fails", async () => {
    const repo = await import("./repository");
    const [created] = await repo.addTasks([{ ...input("Daily"), due: "2026-11-17", repeat: { frequency: "daily" } }]);
    const blocked = path.join(dir, `tasks.json.${process.pid}.tmp`);
    await mkdir(blocked);
    await expect(repo.updateTask(created.id, { done: true })).rejects.toThrow();
    expect(await repo.listTasks()).toEqual([created]);
    await rm(blocked, { recursive: true });
    await repo.updateTask(created.id, { done: true });
    expect(await repo.listTasks()).toHaveLength(2);
  });

  it("reads legacy tasks with no selection and preserves them when saving", async () => {
    const repo = await import("./repository");
    const legacy = {
      ...input("Existing"), id: "old", done: false,
      createdAt: "2026-11-01T12:00:00.000Z", completedAt: null,
    };
    await writeFile(path.join(dir, "tasks.json"), JSON.stringify([legacy]));
    expect(await repo.listTasks()).toEqual([{ ...legacy, estimateHours: null, realTimeHours: null, links: [], nextOccurrenceId: null, partOfDay: null, plannedFor: null }]);
    await repo.updateTask("old", { plannedFor: "2026-11-17" });
    expect(await repo.listTasks()).toEqual([{ ...legacy, estimateHours: null, realTimeHours: null, links: [], nextOccurrenceId: null, partOfDay: null, plannedFor: "2026-11-17" }]);
  });

  it("converts JSON minute estimates on read and writes only hours on the next edit", async () => {
    const repo = await import("./repository");
    const legacy = { ...input("Existing estimate"), id: "old", done: false, createdAt: "2026-11-01T12:00:00.000Z", completedAt: null, estimateMinutes: 90 };
    await writeFile(path.join(dir, "tasks.json"), JSON.stringify([legacy]));
    expect((await repo.listTasks())[0]).toMatchObject({ estimateHours: 1.5, realTimeHours: null });
    await repo.updateTask("old", { realTimeHours: 0.25 });
    const [stored] = JSON.parse(await readFile(path.join(dir, "tasks.json"), "utf8"));
    expect(stored).toMatchObject({ estimateHours: 1.5, realTimeHours: 0.25 });
    expect(stored).not.toHaveProperty("estimateMinutes");
    expect((await repo.listTasks())[0].estimateHours).toBe(1.5);
  });
});
