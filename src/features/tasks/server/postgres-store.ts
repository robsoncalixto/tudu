import pg from "pg";
import type { Task } from "../schema";
import type { TaskStore } from "./store";

type Rows<R> = Promise<{ rows: R[] }>;

/** The slice of a Postgres client the store needs; `pg` and PGlite both fit. */
export interface Queryable {
  query<R>(text: string, params?: unknown[]): Rows<R>;
}

export interface Sql extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
}

// Append-only: a schema change is a new entry, never an edit to an old one.
const MIGRATIONS = [
  `CREATE TABLE tasks (
     seq          bigserial   NOT NULL,
     id           text        PRIMARY KEY,
     title        text        NOT NULL,
     notes        text        NOT NULL DEFAULT '',
     priority     text        NOT NULL,
     due          date,
     tags         jsonb       NOT NULL DEFAULT '[]',
     done         boolean     NOT NULL DEFAULT false,
     created_at   timestamptz NOT NULL,
     completed_at timestamptz,
     planned_for  date
   )`,
  `ALTER TABLE tasks ADD COLUMN steps jsonb NOT NULL DEFAULT '[]'`,
  `ALTER TABLE tasks ADD COLUMN project_id text`,
  `ALTER TABLE tasks ADD COLUMN repeat_rule jsonb, ADD COLUMN next_occurrence_id text`,
  `ALTER TABLE tasks ADD COLUMN estimate_minutes integer, ADD COLUMN links jsonb NOT NULL DEFAULT '[]'`,
  [
    `ALTER TABLE tasks ADD COLUMN estimate_hours double precision, ADD COLUMN real_time_hours double precision`,
    `UPDATE tasks SET estimate_hours = estimate_minutes / 60.0`,
    `ALTER TABLE tasks DROP COLUMN estimate_minutes`,
  ],
];

// Any constant works; it only has to be the same for every TUDU process.
const MIGRATION_LOCK = 7_262_738;

// Dates and timestamps come back as text in the exact format the JSON store
// keeps, so both backends return identical tasks whatever the driver parses.
const ISO = `'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`;
const SELECT = `
  SELECT id, title, notes, priority, tags, done, steps, project_id AS "projectId",
         repeat_rule AS repeat, next_occurrence_id AS "nextOccurrenceId", estimate_hours AS "estimateHours", real_time_hours AS "realTimeHours", links,
         to_char(due, 'YYYY-MM-DD') AS due,
         to_char(planned_for, 'YYYY-MM-DD') AS "plannedFor",
         to_char(created_at AT TIME ZONE 'UTC', ${ISO}) AS "createdAt",
         to_char(completed_at AT TIME ZONE 'UTC', ${ISO}) AS "completedAt"
    FROM tasks`;

function insertTask(sql: Queryable, task: Task) {
  return sql.query(
    `INSERT INTO tasks (id, title, notes, priority, due, tags, done, created_at, completed_at, planned_for, steps, project_id, repeat_rule, next_occurrence_id, estimate_hours, links, real_time_hours)
     VALUES ($1, $2, $3, $4, $5::date, $6::jsonb, $7, $8::timestamptz, $9::timestamptz, $10::date, $11::jsonb, $12, $13::jsonb, $14, $15, $16::jsonb, $17)
     ON CONFLICT (id) DO NOTHING`,
    [
      task.id,
      task.title,
      task.notes,
      task.priority,
      task.due,
      JSON.stringify(task.tags),
      task.done,
      task.createdAt,
      task.completedAt,
      task.plannedFor,
      JSON.stringify(task.steps),
      task.projectId,
      JSON.stringify(task.repeat),
      task.nextOccurrenceId,
      task.estimateHours,
      JSON.stringify(task.links),
      task.realTimeHours,
    ],
  );
}

async function migrate(sql: Sql, seed?: () => Promise<Task[]>): Promise<void> {
  await sql.transaction(async (tx) => {
    // Two processes starting at once must not both create the table.
    await tx.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK]);
    await tx.query(
      `CREATE TABLE IF NOT EXISTS tudu_migrations (
         version    integer     PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    const { rows } = await tx.query<{ version: number }>(
      "SELECT coalesce(max(version), 0)::integer AS version FROM tudu_migrations",
    );
    const current = rows[0].version;
    for (let version = current + 1; version <= MIGRATIONS.length; version++) {
      const migration = MIGRATIONS[version - 1];
      for (const statement of typeof migration === "string" ? [migration] : migration) await tx.query(statement);
      await tx.query("INSERT INTO tudu_migrations (version) VALUES ($1)", [version]);
    }
    // Only a brand-new database is seeded, so switching to Postgres keeps the
    // tasks already written to the JSON file, and later restarts never re-add
    // tasks the person has since deleted.
    if (current === 0 && seed) {
      for (const task of await seed()) await insertTask(tx, task);
    }
  });
}

/**
 * Keeps tasks in a `tasks` table. The schema is created or upgraded on first
 * use; `seed` supplies the tasks to copy into a database created from scratch.
 */
export function createPostgresStore(sql: Sql, options: { seed?: () => Promise<Task[]> } = {}): TaskStore {
  let ready: Promise<void> | null = null;

  // Retried on the next call if it fails, so a database that starts after the
  // app does is picked up without a restart.
  function whenReady(): Promise<void> {
    ready ??= migrate(sql, options.seed).catch((error: unknown) => {
      ready = null;
      throw error;
    });
    return ready;
  }

  return {
    async clearProject(id) {
      await whenReady();
      await sql.query("UPDATE tasks SET project_id = NULL WHERE project_id = $1", [id]);
    },
    async list() {
      await whenReady();
      return (await sql.query<Task>(`${SELECT} ORDER BY seq`)).rows;
    },

    async insert(created) {
      await whenReady();
      await sql.transaction(async (tx) => {
        for (const task of created) await insertTask(tx, task);
      });
    },

    async modify(id, change) {
      await whenReady();
      return sql.transaction(async (tx) => {
        const { rows } = await tx.query<Task>(`${SELECT} WHERE id = $1 FOR UPDATE`, [id]);
        if (rows.length === 0) return null;
        const result = change(rows[0]);
        const next = result.task;
        await tx.query(
          `UPDATE tasks
              SET title = $2, notes = $3, priority = $4, due = $5::date, tags = $6::jsonb,
                  done = $7, completed_at = $8::timestamptz, planned_for = $9::date, steps = $10::jsonb, project_id = $11,
                  repeat_rule = $12::jsonb, next_occurrence_id = $13, estimate_hours = $14, links = $15::jsonb, real_time_hours = $16
            WHERE id = $1`,
          [
            id,
            next.title,
            next.notes,
            next.priority,
            next.due,
            JSON.stringify(next.tags),
            next.done,
            next.completedAt,
            next.plannedFor,
            JSON.stringify(next.steps),
            next.projectId,
            JSON.stringify(next.repeat),
            next.nextOccurrenceId,
            next.estimateHours,
            JSON.stringify(next.links),
            next.realTimeHours,
          ],
        );
        if (result.nextTask) await insertTask(tx, result.nextTask);
        const children = next.nextOccurrenceId
          ? (await tx.query<Task>(`${SELECT} WHERE id = $1`, [next.nextOccurrenceId])).rows : [];
        return { task: next, nextTask: children[0] ?? null };
      });
    },

    async remove(id) {
      await whenReady();
      const { rows } = await sql.query("DELETE FROM tasks WHERE id = $1 RETURNING id", [id]);
      return rows.length > 0;
    },
  };
}

// One pool per database URL for the life of the process; the dev server may
// load this module more than once.
const state = globalThis as typeof globalThis & { __tuduPools?: Map<string, pg.Pool> };

/** Connects to the database at `url` through a shared `pg` pool. */
export function connectPostgres(url: string): Sql {
  state.__tuduPools ??= new Map();
  let pool = state.__tuduPools.get(url);
  if (!pool) {
    pool = new pg.Pool({ connectionString: url });
    // An idle connection dropped by the server must not crash the app; the
    // pool opens a new one on the next query.
    pool.on("error", (error) => console.error("Postgres connection error:", error.message));
    state.__tuduPools.set(url, pool);
  }
  const shared = pool;

  return {
    async query<R>(text: string, params?: unknown[]) {
      return { rows: (await shared.query(text, params)).rows as R[] };
    },
    async transaction(fn) {
      const client = await shared.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({
          query: async <R>(text: string, params?: unknown[]) => ({
            rows: (await client.query(text, params)).rows as R[],
          }),
        });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
