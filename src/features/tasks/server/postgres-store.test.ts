import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../schema";
import { createPostgresStore } from "./postgres-store";
import { createRepository } from "./repository";

const task = (id: string, title: string): Task => ({
  id,
  title,
  notes: "",
  priority: "medium",
  due: "2026-11-20",
  tags: ["work"],
  steps: [],
  projectId: null,
  repeat: null,
  nextOccurrenceId: null,
  estimateHours: null, realTimeHours: null, partOfDay: null, dayRanks: {}, planChangedAt: null,
  links: [],
  done: true,
  createdAt: "2026-11-10T09:30:00.000Z",
  completedAt: "2026-11-12T18:05:42.123Z",
  plannedFor: "2026-11-17",
});

let db: PGlite;

beforeEach(() => {
  db = new PGlite();
});

afterEach(() => db.close());

describe("postgres store", () => {
  it("converts version-five minute estimates to fractional hours exactly once", async () => {
    await createPostgresStore(db).insert([task("old", "Existing estimate"), task("empty", "No estimate")]);
    await db.query("ALTER TABLE tasks ADD COLUMN estimate_minutes integer");
    await db.query("UPDATE tasks SET estimate_minutes = 90 WHERE id = 'old'");
    await db.query("ALTER TABLE tasks DROP COLUMN estimate_hours, DROP COLUMN real_time_hours");
    await db.query("ALTER TABLE tasks DROP COLUMN day_ranks, DROP COLUMN plan_changed_at");
    await db.query("ALTER TABLE tasks DROP COLUMN part_of_day");
    await db.query("DELETE FROM tudu_migrations WHERE version >= 6");
    const store = createPostgresStore(db);
    expect(await store.list()).toEqual([{ ...task("old", "Existing estimate"), estimateHours: 1.5 }, task("empty", "No estimate")]);
    const repo = createRepository(store);
    await repo.updateTask("old", { realTimeHours: 0.25 });
    expect((await createPostgresStore(db).list())[0]).toMatchObject({ estimateHours: 1.5, realTimeHours: 0.25 });
    expect((await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'estimate_minutes'")).rows).toEqual([]);
  });

  it("stores and validates the part of day across inserts and updates", async () => {
    const store = createPostgresStore(db);
    await store.insert([{ ...task("timed", "Report"), partOfDay: "morning" }]);
    expect((await store.list())[0].partOfDay).toBe("morning");
    await createRepository(store).updateTask("timed", { partOfDay: "evening" });
    await expect(db.query("UPDATE tasks SET part_of_day = 'midnight' WHERE id = 'timed'")).rejects.toThrow();
    expect((await createPostgresStore(db).list())[0].partOfDay).toBe("evening");
  });

  it("rolls back completion when inserting the next occurrence fails", async () => {
    const repo = createRepository(createPostgresStore(db));
    const [created] = await repo.addTasks([{ ...task("a", "Report"), due: "2026-11-17", repeat: { frequency: "daily" } }]);
    await db.query("ALTER TABLE tasks ADD CONSTRAINT test_due CHECK (due <= '2026-11-17'::date)");
    await expect(repo.updateTask(created.id, { done: true })).rejects.toThrow();
    expect(await repo.listTasks()).toEqual([created]);
    await db.query("ALTER TABLE tasks DROP CONSTRAINT test_due");
    await repo.updateTask(created.id, { done: true });
    expect(await repo.listTasks()).toHaveLength(2);
  });
  it("creates its schema on first use and records the version", async () => {
    await createPostgresStore(db).list();
    const { rows } = await db.query<{ version: number }>("SELECT version FROM tudu_migrations");
    expect(rows).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }, { version: 6 }, { version: 7 }, { version: 8 }]);
  });

  it("does not run migrations again for a later process", async () => {
    await createPostgresStore(db).insert([task("a", "kept")]);
    expect(await createPostgresStore(db).list()).toMatchObject([{ id: "a", title: "kept" }]);
    const { rows } = await db.query("SELECT version FROM tudu_migrations");
    expect(rows).toHaveLength(8);
  });

  it("copies the seed tasks into a new database, keeping ids, dates and order", async () => {
    const seeded = [{ ...task("a", "first"), estimateHours: 0.5, links: ["https://example.org/brief"] }, task("b", "second")];
    const store = createPostgresStore(db, { seed: async () => seeded });
    expect(await store.list()).toEqual(seeded);
  });

  it("seeds only once, so deleted tasks do not come back", async () => {
    const seed = vi.fn(async () => [task("a", "first")]);
    await createPostgresStore(db, { seed }).remove("a");
    expect(await createPostgresStore(db, { seed }).list()).toEqual([]);
    expect(seed).toHaveBeenCalledTimes(1);
  });

  it("retries the set-up after a failure", async () => {
    const seed = vi
      .fn<() => Promise<Task[]>>()
      .mockRejectedValueOnce(new Error("file unreadable"))
      .mockResolvedValue([task("a", "first")]);
    const store = createPostgresStore(db, { seed });
    await expect(store.list()).rejects.toThrow("file unreadable");
    expect(await store.list()).toMatchObject([{ id: "a" }]);
  });

  it("upgrades a version-one database without changing existing tasks", async () => {
    const legacy = task("old", "Existing report");
    await createPostgresStore(db).insert([legacy]);
    await db.query("ALTER TABLE tasks DROP COLUMN steps, DROP COLUMN project_id, DROP COLUMN repeat_rule, DROP COLUMN next_occurrence_id, DROP COLUMN estimate_hours, DROP COLUMN real_time_hours, DROP COLUMN links, DROP COLUMN part_of_day, DROP COLUMN day_ranks, DROP COLUMN plan_changed_at");
    await db.query("DELETE FROM tudu_migrations WHERE version >= 2");
    expect(await createPostgresStore(db).list()).toEqual([{ ...legacy, steps: [] }]);
    expect((await db.query("SELECT version FROM tudu_migrations ORDER BY version")).rows)
      .toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }, { version: 6 }, { version: 7 }, { version: 8 }]);
  });
  it("upgrades a checklist database with no project column while keeping its steps", async () => {
    const existing = { ...task("old", "Existing checklist"), steps: [{ id: "step", title: "Draft", done: true }] };
    await createPostgresStore(db).insert([existing]);
    await db.query("ALTER TABLE tasks DROP COLUMN project_id, DROP COLUMN repeat_rule, DROP COLUMN next_occurrence_id, DROP COLUMN estimate_hours, DROP COLUMN real_time_hours, DROP COLUMN links, DROP COLUMN part_of_day, DROP COLUMN day_ranks, DROP COLUMN plan_changed_at");
    await db.query("DELETE FROM tudu_migrations WHERE version >= 3");
    expect(await createPostgresStore(db).list()).toEqual([existing]);
  });
  it("upgrades a project database without changing task content or completion", async () => {
    const existing = { ...task("old", "Project report"), projectId: "p1", steps: [{ id: "s", title: "Draft", done: true }] };
    await createPostgresStore(db).insert([existing]);
    await db.query("ALTER TABLE tasks DROP COLUMN repeat_rule, DROP COLUMN next_occurrence_id, DROP COLUMN estimate_hours, DROP COLUMN real_time_hours, DROP COLUMN links, DROP COLUMN part_of_day, DROP COLUMN day_ranks, DROP COLUMN plan_changed_at");
    await db.query("DELETE FROM tudu_migrations WHERE version >= 4");
    expect(await createPostgresStore(db).list()).toEqual([existing]);
  });
});
