import { describe, expect, it } from "vitest";
import { taskSchema, type Task } from "@/features/tasks/schema";
import { isForToday } from "@/features/tasks/selectors";
import { listTasksToolSchema, type TaskFilters } from "./schema";
import { filterTasks as filterWithToday } from "./selectors";

const projectId = "00000000-0000-4000-8000-000000000001";
const task = (id: string) => taskSchema.parse({ id, title: id, done: false, createdAt: "2026-11-01T12:00:00Z", completedAt: null });
const tasks = [
  { ...task("Report"), notes: "Ask ANA", priority: "high" as const, tags: ["work"], projectId, due: "2026-11-17" },
  { ...task("Invoice"), done: true, due: "2026-11-16" },
  { ...task("Selected"), plannedFor: "2026-11-17" },
  { ...task("Later"), due: "2026-11-20", tags: ["work"] }, task("Undated"),
];
const filterTasks = (candidates: Task[], filters: TaskFilters) => filterWithToday(candidates, filters, isForToday);
describe("MCP task filters", () => {
  it("combines state, tags, project, priority and case-insensitive text without changing stored order", () => {
    const before = structuredClone(tasks);
    expect(filterTasks(tasks, listTasksToolSchema.parse({ state: "open", tag: "work", projectId, priority: "high", query: "ana" })).tasks).toEqual([tasks[0]]);
    expect(filterTasks(tasks, listTasksToolSchema.parse({ state: "done" })).tasks).toEqual([tasks[1]]);
    expect(filterTasks(tasks, listTasksToolSchema.parse({ projectId: null })).tasks).toEqual(tasks.slice(1));
    expect(tasks).toEqual(before);
  });
  it("uses inclusive due ranges, explicit planning and Today view semantics", () => {
    expect(filterTasks(tasks, listTasksToolSchema.parse({ dueFrom: "2026-11-17", dueTo: "2026-11-20" })).tasks).toEqual([tasks[0], tasks[3]]);
    expect(filterTasks(tasks, listTasksToolSchema.parse({ plannedFor: "2026-11-17" })).tasks).toEqual([tasks[2]]);
    expect(filterTasks(tasks, listTasksToolSchema.parse({ today: "2026-11-17" })).tasks).toEqual(tasks.slice(0, 3));
  });
  it("carries open plans forward but keeps completed and future plans on their original days", () => {
    const candidates = [
      { ...task("Carry-over"), plannedFor: "2026-11-16" },
      { ...task("Done"), plannedFor: "2026-11-16", done: true },
      { ...task("Future"), plannedFor: "2026-11-18" },
    ];
    expect(filterTasks(candidates, listTasksToolSchema.parse({ today: "2026-11-17" })).tasks).toEqual([candidates[0]]);
  });
  it("reports filtered totals and pagination without losing tasks", () => {
    const first = filterTasks(tasks, listTasksToolSchema.parse({ limit: 2 }));
    expect(first).toEqual({ tasks: tasks.slice(0, 2), total: 5, nextOffset: 2 });
    expect(filterTasks(tasks, listTasksToolSchema.parse({ offset: 4, limit: 2 }))).toEqual({ tasks: tasks.slice(4), total: 5, nextOffset: null });
    expect(filterTasks(tasks, listTasksToolSchema.parse({ offset: 20 }))).toEqual({ tasks: [], total: 5, nextOffset: null });
  });
  it("rejects unknown filters, impossible dates, reversed ranges and invalid pagination", () => {
    for (const input of [{ state: "maybe" }, { projectId: "unknown" }, { today: "2026-02-30" }, { dueFrom: "2026-11-20", dueTo: "2026-11-17" }, { limit: 0 }, { limit: 201 }, { offset: -1 }, { unknown: true }]) {
      expect(listTasksToolSchema.safeParse(input).success).toBe(false);
    }
  });
});
