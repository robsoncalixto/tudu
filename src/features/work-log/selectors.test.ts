import { describe, expect, it } from "vitest";
import { taskSchema } from "@/features/tasks/schema";
import { completedOn, groupWorkLog, totalWorkLogTime } from "./selectors";
import { workLogQuerySchema } from "./schema";

const p1 = "00000000-0000-4000-8000-000000000001";
const p2 = "00000000-0000-4000-8000-000000000002";
const projects = [{ id: p1, name: "Acme" }, { id: p2, name: "Internal" }];
export function completedTask(id: string, completedAt = "2026-11-17T15:00:00.000Z") {
  return taskSchema.parse({ id, title: id, done: true, completedAt, createdAt: "2026-11-01T12:00:00.000Z" });
}

describe("work-log query", () => {
  it("validates real calendar dates and IANA time zones, rejecting supplied task content", () => {
    expect(workLogQuerySchema.parse({ day: "2026-11-17", timeZone: "America/Sao_Paulo" })).toEqual({ day: "2026-11-17", timeZone: "America/Sao_Paulo" });
    for (const query of [
      { day: "2026-02-30", timeZone: "UTC" }, { day: "today", timeZone: "UTC" },
      { day: "2026-11-17", timeZone: "Unknown/Zone" }, { day: "2026-11-17", timeZone: "UTC", tasks: [] },
    ]) expect(workLogQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe("completedOn", () => {
  it("uses completion rather than creation, due date or Today selection, without mutating tasks", () => {
    const tasks = [
      completedTask("yesterday", "2026-11-17T02:59:59.999Z"),
      { ...completedTask("late", "2026-11-18T02:59:59.999Z"), due: "2026-12-01", plannedFor: "2026-11-16" },
      completedTask("midnight", "2026-11-17T03:00:00.000Z"),
      completedTask("tomorrow", "2026-11-18T03:00:00.000Z"),
      { ...completedTask("reopened"), done: false }, { ...completedTask("missing"), completedAt: null },
    ];
    const before = structuredClone(tasks);
    expect(completedOn(tasks, { day: "2026-11-17", timeZone: "America/Sao_Paulo" }).map((task) => task.id)).toEqual(["midnight", "late"]);
    expect(tasks).toEqual(before);
    expect(completedOn(tasks, { day: "2026-11-17", timeZone: "UTC" }).map((task) => task.id)).toEqual(["yesterday", "midnight"]);
  });
  it("handles a 23-hour day across daylight-saving time and breaks completion ties by id", () => {
    const tasks = [
      completedTask("before", "2026-03-08T04:59:59.999Z"),
      completedTask("b", "2026-03-08T05:00:00.000Z"), completedTask("a", "2026-03-08T05:00:00.000Z"),
      completedTask("end", "2026-03-09T03:59:59.999Z"), completedTask("after", "2026-03-09T04:00:00.000Z"),
    ];
    expect(completedOn(tasks, { day: "2026-03-08", timeZone: "America/New_York" }).map((task) => task.id)).toEqual(["a", "b", "end"]);
    expect(completedOn(tasks, { day: "bad", timeZone: "UTC" })).toEqual([]);
    expect(completedOn(tasks, { day: "2026-03-08", timeZone: "bad" })).toEqual([]);
  });
});

describe("groupWorkLog", () => {
  const tasks = [
    { ...completedTask("Report"), projectId: p1, tags: ["work", "client", "work"] },
    { ...completedTask("Invoice"), projectId: p2, tags: ["work"] }, completedTask("Unassigned"),
    { ...completedTask("Deleted project"), projectId: "00000000-0000-4000-8000-000000000003" },
  ];
  it("groups known projects and puts missing or deleted assignments last", () => {
    const grouped = groupWorkLog(tasks, projects, "project");
    expect(grouped.map((group) => [group.label, group.tasks.map((task) => task.title)])).toEqual([
      ["Acme", ["Report"]], ["Internal", ["Invoice"]], [null, ["Unassigned", "Deleted project"]],
    ]);
  });
  it("includes every matching tag once, with an untagged group and an ungrouped option", () => {
    expect(groupWorkLog(tasks, projects, "tag").map((group) => [group.label, group.tasks.map((task) => task.title)])).toEqual([
      ["client", ["Report"]], ["work", ["Report", "Invoice"]], [null, ["Unassigned", "Deleted project"]],
    ]);
    expect(groupWorkLog(tasks, projects, "none")).toMatchObject([{ label: null, kind: "none", tasks }]);
    expect(groupWorkLog([], projects, "project")).toEqual([]);
  });
});

describe("time totals", () => {
  it("counts duplicate tag appearances once, includes zero and skips missing actual times", () => {
    const timed = { ...completedTask("Timed"), tags: ["a", "b"], realTimeHours: 1.5 };
    const tasks = [timed, { ...completedTask("Zero"), realTimeHours: 0 }, { ...completedTask("Missing"), estimateHours: 8 }];
    const groups = groupWorkLog(tasks, [], "tag");
    expect(groups.map((group) => totalWorkLogTime(group.tasks))).toEqual([
      { hours: 1.5, missing: 0 }, { hours: 1.5, missing: 0 }, { hours: 0, missing: 1 },
    ]);
    expect(totalWorkLogTime(groups.flatMap((group) => group.tasks))).toEqual({ hours: 1.5, missing: 1 });
  });
});
