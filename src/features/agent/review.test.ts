import { describe, expect, it } from "vitest";
import { taskSchema } from "@/features/tasks/schema";
import { taskReviewContext } from "./review";

const today = "2026-11-17";
const stored = (id: string, fields = {}) => taskSchema.parse({
  id, title: id, notes: "x".repeat(2000), done: false, createdAt: "2026-11-01T00:00:00Z", completedAt: null, ...fields,
});

describe("review context budget", () => {
  it("ranks genuine deadlines ahead of historical dates that need correction", () => {
    const invalid = stored("Invalid", { due: "2026-02-30", plannedFor: "0000-01-01" });
    const actual = stored("Actual", { due: today });
    expect(taskReviewContext([invalid, actual], [], today, "").tasks)
      .toMatchObject([{ id: actual.id, due: today }, { id: invalid.id, due: null, plannedFor: null }]);
    expect(invalid).toMatchObject({ due: "2026-02-30", plannedFor: "0000-01-01" });
  });
  it("keeps overdue and carried-over work at the front and leaves room for an optional note", () => {
    const tasks = [...Array.from({ length: 200 }, (_, index) => stored(`Backlog ${index}`)),
      stored("Earlier plan", { plannedFor: "2026-11-15", estimateHours: 2, realTimeHours: 0.5 }),
      stored("Late task", { due: "2026-11-16" }), stored("Closed", { done: true, due: "2026-11-14" }),
    ];
    const note = '"'.repeat(8000);
    const context = taskReviewContext(tasks, [], today, note);
    expect(context.tasks.slice(0, 2)).toMatchObject([{ id: "Late task" }, { id: "Earlier plan", estimateHours: 2, realTimeHours: 0.5 }]);
    expect(context.openTasks).toBe(202);
    expect(context.omittedTasks).toBeGreaterThan(0);
    expect(JSON.stringify({ context, note }).length).toBeLessThan(60_000);
  });
});
