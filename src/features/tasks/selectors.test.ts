import { describe, expect, it } from "vitest";
import type { Task } from "./schema";
import { buildTaskView } from "./selectors";

let counter = 0;
function task(overrides: Partial<Task> = {}): Task {
  counter += 1;
  return {
    id: `t${counter}`,
    title: `Task ${counter}`,
    notes: "",
    priority: "medium",
    due: null,
    tags: [],
    done: false,
    createdAt: `2026-01-01T00:00:${String(counter).padStart(2, "0")}.000Z`,
    completedAt: null,
    plannedFor: null,
    steps: [],
    projectId: null,
    repeat: null,
    nextOccurrenceId: null,
    ...overrides,
  };
}

const titles = (tasks: Task[]) => tasks.map((item) => item.title);

describe("buildTaskView", () => {
  it("puts dated tasks before undated ones, earliest first", () => {
    const view = buildTaskView(
      [
        task({ title: "undated" }),
        task({ title: "later", due: "2026-03-10" }),
        task({ title: "sooner", due: "2026-03-01" }),
      ],
      { kind: "all" },
    );
    expect(titles(view.open)).toEqual(["sooner", "later", "undated"]);
  });

  it("breaks due-date ties by priority, then by age", () => {
    const view = buildTaskView(
      [
        task({ title: "low", priority: "low" }),
        task({ title: "medium-old" }),
        task({ title: "medium-new" }),
        task({ title: "high", priority: "high" }),
      ],
      { kind: "all" },
    );
    expect(titles(view.open)).toEqual(["high", "medium-old", "medium-new", "low"]);
  });

  it("separates done tasks and lists the most recently completed first", () => {
    const view = buildTaskView(
      [
        task({ title: "open" }),
        task({ title: "done-earlier", done: true, completedAt: "2026-02-01T10:00:00.000Z" }),
        task({ title: "done-later", done: true, completedAt: "2026-02-02T10:00:00.000Z" }),
      ],
      { kind: "all" },
    );
    expect(titles(view.open)).toEqual(["open"]);
    expect(titles(view.done)).toEqual(["done-later", "done-earlier"]);
  });

  it("filters both lists by tag but counts open tasks across all tags", () => {
    const view = buildTaskView(
      [
        task({ title: "a", tags: ["work"] }),
        task({ title: "b", tags: ["home"] }),
        task({ title: "c", tags: ["work"], done: true, completedAt: "2026-02-01T10:00:00.000Z" }),
      ],
      { kind: "tag", tag: "work" },
    );
    expect(titles(view.open)).toEqual(["a"]);
    expect(titles(view.done)).toEqual(["c"]);
    expect(view.openCount).toBe(2);
  });

  it("counts tags on open tasks only, sorted by name", () => {
    const view = buildTaskView(
      [
        task({ tags: ["work", "alpha"] }),
        task({ tags: ["work"] }),
        task({ tags: ["archived"], done: true }),
      ],
      { kind: "all" },
    );
    expect(view.tagCounts).toEqual([
      ["alpha", 1],
      ["work", 2],
    ]);
  });

  it("does not reorder the array it was given", () => {
    const input = [task({ title: "undated" }), task({ title: "dated", due: "2026-03-01" })];
    buildTaskView(input, { kind: "all" });
    expect(titles(input)).toEqual(["undated", "dated"]);
  });
});

describe("Today view", () => {
  const today = "2026-11-17";
  const todayFilter = { kind: "today" } as const;

  it("includes picked, due-today and overdue tasks once, sorted by urgency", () => {
    const view = buildTaskView([
      task({ title: "picked", plannedFor: today }),
      task({ title: "both", plannedFor: today, due: today }),
      task({ title: "overdue", due: "2026-11-16" }),
      task({ title: "future picked", due: "2026-12-01", plannedFor: today }),
      task({ title: "future", due: "2026-11-18" }),
      task({ title: "undated" }),
      task({ title: "yesterday's pick", plannedFor: "2026-11-16" }),
      task({ title: "tomorrow's pick", plannedFor: "2026-11-18" }),
    ], todayFilter, today);
    expect(titles(view.open)).toEqual(["overdue", "both", "future picked", "picked"]);
    expect(view.todayCount).toBe(4);
    expect(view.openCount).toBe(8);
  });

  it("keeps matching completed tasks separate and excludes them from the badge", () => {
    const view = buildTaskView([
      task({ title: "open", plannedFor: today }),
      task({ title: "done", plannedFor: today, done: true, completedAt: "2026-11-17T14:00:00.000Z" }),
      task({ title: "unrelated done", done: true }),
    ], todayFilter, today);
    expect(titles(view.open)).toEqual(["open"]);
    expect(titles(view.done)).toEqual(["done"]);
    expect(view.todayCount).toBe(1);
  });

  it("counts today across tags and retains all-tasks and tag navigation", () => {
    const tasks = [
      task({ title: "work", plannedFor: today, tags: ["work"] }),
      task({ title: "home", due: today, tags: ["home"] }),
      task({ title: "later", tags: ["work"] }),
    ];
    const view = buildTaskView(tasks, { kind: "tag", tag: "work" }, today);
    expect(titles(view.open)).toEqual(["work", "later"]);
    expect(view.todayCount).toBe(2);
    expect(view.tagCounts).toEqual([["home", 1], ["work", 2]]);
    expect(buildTaskView(tasks, { kind: "all" }, today).open).toHaveLength(3);
  });

  it("expires yesterday's picks but keeps overdue tasks when the date changes", () => {
    const tasks = [task({ title: "pick", plannedFor: today }), task({ title: "deadline", due: today })];
    expect(buildTaskView(tasks, todayFilter, today).todayCount).toBe(2);
    const nextDay = buildTaskView(tasks, todayFilter, "2026-11-18");
    expect(titles(nextDay.open)).toEqual(["deadline"]);
    expect(tasks[0].plannedFor).toBe(today);
  });

  it("keeps deadline-driven tasks after a manual selection is removed", () => {
    const view = buildTaskView([
      task({ title: "due", due: today, plannedFor: null }),
      task({ title: "late", due: "2026-11-16", plannedFor: null }),
      task({ title: "removed", plannedFor: null }),
    ], todayFilter, today);
    expect(titles(view.open)).toEqual(["late", "due"]);
  });

  it("shows no today tasks until the local date is available", () => {
    const view = buildTaskView([task({ due: today })], todayFilter);
    expect(view.todayCount).toBe(0);
    expect(view.open).toEqual([]);
  });
});

describe("project views", () => {
  it("filters open and completed tasks while keeping global project counts and tags", () => {
    const acme = { id: "00000000-0000-4000-8000-000000000001", name: "Acme" };
    const beta = { id: "00000000-0000-4000-8000-000000000002", name: "Beta" };
    const tasks = [
      task({ title: "Acme open", projectId: acme.id, tags: ["work"] }),
      task({ title: "Acme done", projectId: acme.id, done: true }),
      task({ title: "Beta open", projectId: beta.id }), task({ title: "Unassigned" }),
    ];
    const projects = [beta, acme];
    const view = buildTaskView(tasks, { kind: "project", id: acme.id }, "2026-11-17", projects);
    expect(titles(view.open)).toEqual(["Acme open"]);
    expect(titles(view.done)).toEqual(["Acme done"]);
    expect(view.openCount).toBe(3);
    expect(view.projectCounts).toEqual([[acme, 1], [beta, 1]]);
    expect(view.tagCounts).toEqual([["work", 1]]);
    expect(projects).toEqual([beta, acme]);
    expect(buildTaskView(tasks, { kind: "tag", tag: "work" }, "2026-11-17", projects).projectCounts).toEqual(view.projectCounts);
  });
  it("keeps projects with no open tasks in navigation", () => {
    const empty = { id: "00000000-0000-4000-8000-000000000001", name: "Empty" };
    const view = buildTaskView([], { kind: "project", id: empty.id }, "2026-11-17", [empty]);
    expect(view.open).toEqual([]);
    expect(view.projectCounts).toEqual([[empty, 0]]);
  });
});
