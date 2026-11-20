import { describe, expect, it } from "vitest";
import { taskSchema } from "@/features/tasks/schema";
import { recommendPlacement, upcomingWorkload, workloadForDay } from "./workload";

const day = "2026-11-17";
const capacity = { workingDays: [1, 2, 3, 4, 5], workHoursPerDay: 6 };
const task = (id: string, fields = {}) => taskSchema.parse({
  id, title: id, done: false, completedAt: null, createdAt: "2026-11-10T12:00:00Z", ...fields,
});

describe("daily workload", () => {
  it("ignores impossible legacy dates and uses a valid deadline when a saved plan is invalid", () => {
    const tasks = [task("Invalid due", { due: "2026-02-30" }), task("Invalid plan", { plannedFor: "0000-01-01", due: "2026-11-18" })];
    expect(upcomingWorkload(tasks, day, capacity, 2).map(({ hours }) => hours)).toEqual([0, 1]);
  });
  it("counts each open task once per day and uses a one-hour fallback", () => {
    const tasks = [task("Both", { due: day, plannedFor: day, estimateHours: 3, partOfDay: "morning" }),
      task("Missing", { due: day }), task("Closed", { done: true, due: day, estimateHours: 10 })];
    expect(workloadForDay(tasks, day, capacity)).toEqual({ day, capacity: 6, hours: 4, unestimated: 1,
      periods: { morning: 3, afternoon: 0, evening: 0 } });
    expect(workloadForDay([], "2026-11-21", capacity).capacity).toBe(0);
  });

  it("counts work on its assigned day and carries overdue effort into the first day", () => {
    const tasks = [
      task("Planned", { plannedFor: day, due: "2026-11-18", estimateHours: 2 }),
      task("Overdue", { due: "2026-11-16", estimateHours: 3 }),
      task("Old plan", { plannedFor: "2026-11-16", due: "2026-11-19" }),
    ];
    expect(upcomingWorkload(tasks, day, capacity, 3).map(({ hours }) => hours)).toEqual([6, 0, 0]);
  });

  it("places high-priority work in the first feasible day and uses its estimate", () => {
    const tasks = [task("Morning task", { plannedFor: day, estimateHours: 2, partOfDay: "morning" })];
    const days = upcomingWorkload(tasks, day, capacity, 3);
    expect(recommendPlacement({ priority: "high", estimateHours: 2 }, days))
      .toEqual({ day, partOfDay: "afternoon", free: 4, effort: 2, usedDefault: false });
    expect(recommendPlacement({ priority: "low" }, days)).toMatchObject({ day: "2026-11-18", effort: 1, usedDefault: true });
    expect(recommendPlacement({ priority: "high", estimateHours: 7 }, days)).toBeNull();
  });
});

it("respects the configured days across a month boundary", () => {
  const days = upcomingWorkload([], "2026-12-31", { workingDays: [1], workHoursPerDay: 3 }, 6);
  expect(recommendPlacement({ priority: "medium", estimateHours: 2 }, days)).toMatchObject({ day: "2027-01-04", free: 3 });
});
