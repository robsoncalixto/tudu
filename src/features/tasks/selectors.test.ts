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
      null,
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
      null,
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
      null,
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
      "work",
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
      null,
    );
    expect(view.tagCounts).toEqual([
      ["alpha", 1],
      ["work", 2],
    ]);
  });

  it("does not reorder the array it was given", () => {
    const input = [task({ title: "undated" }), task({ title: "dated", due: "2026-03-01" })];
    buildTaskView(input, null);
    expect(titles(input)).toEqual(["undated", "dated"]);
  });
});
