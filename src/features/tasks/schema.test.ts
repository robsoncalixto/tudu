import { describe, expect, it } from "vitest";
import { storedTaskSchema, taskCreationSchema, taskInputSchema, taskPatchSchema, taskSchema } from "./schema";

describe("task estimates and reference links", () => {
  const valid = { estimateHours: 0.75, realTimeHours: 1 / 60, links: ["https://example.org/brief", "http://localhost:3001/file.pdf"] };

  it("accepts the same resources on creation and partial update, including explicit clears", () => {
    expect(taskCreationSchema("low").parse({ title: "Review", ...valid })).toMatchObject(valid);
    expect(taskPatchSchema.parse(valid)).toEqual(valid);
    expect(taskPatchSchema.parse({ estimateHours: null, realTimeHours: null, links: [] })).toEqual({ estimateHours: null, realTimeHours: null, links: [] });
    expect(taskPatchSchema.parse({ title: "Edit" })).toEqual({ title: "Edit" });
  });

  it.each([
    { estimateHours: -1 }, { estimateHours: 0 }, { estimateHours: Infinity }, { estimateHours: 8760.1 },
    { realTimeHours: -1 }, { realTimeHours: 0 }, { realTimeHours: Infinity }, { realTimeHours: 8760.1 },
    { links: ["javascript:alert(1)"] }, { links: ["data:text/plain,hi"] }, { links: ["https:example.org"] },
    { links: ["/local/file"] }, { links: ["https://"] }, { links: ["https://example.org/a b"] },
    { links: ["https://example.org", " https://example.org "] }, { links: ["https://example.org/" + "a".repeat(2048)] },
    { links: Array.from({ length: 21 }, (_, i) => `https://example.org/${i}`) },
  ])("rejects invalid resource fields throughout the API contract", (fields) => {
    expect(taskPatchSchema.safeParse(fields).success).toBe(false);
    expect(taskCreationSchema("medium").safeParse({ title: "Review", ...fields }).success).toBe(false);
  });
});

describe("taskInputSchema", () => {
  it("fills defaults for a title-only task", () => {
    expect(taskInputSchema.parse({ title: "  Call Ana  " })).toEqual({
      title: "Call Ana",
      notes: "",
      priority: "medium",
      due: null,
      tags: [],
      steps: [],
      projectId: null,
      repeat: null,
    });
  });

  it("rejects a blank title", () => {
    expect(taskInputSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  it("rejects a due date that is not YYYY-MM-DD", () => {
    expect(taskInputSchema.safeParse({ title: "x", due: "17/11/2026" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ title: "x", due: "2026-11-17" }).success).toBe(true);
  });

  it.each(["2026-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "0000-01-01"])(
    "rejects the impossible deadline %s in new tasks, batches and updates", (due) => {
      const draft = { title: "Report", due };
      expect(taskInputSchema.safeParse(draft).success).toBe(false);
      expect(taskCreationSchema("medium").safeParse([{ title: "Other" }, draft]).success).toBe(false);
      expect(taskPatchSchema.safeParse({ due }).success).toBe(false);
    },
  );

  it("rejects an unknown priority", () => {
    expect(taskInputSchema.safeParse({ title: "x", priority: "urgent" }).success).toBe(false);
  });
});

describe("taskPatchSchema", () => {
  it("accepts a partial change and adds nothing to it", () => {
    expect(taskPatchSchema.parse({ done: true })).toEqual({ done: true });
  });

  it("allows clearing the due date", () => {
    expect(taskPatchSchema.parse({ due: null })).toEqual({ due: null });
  });

  it("rejects an empty title", () => {
    expect(taskPatchSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("accepts a daily selection and allows clearing it without adding other fields", () => {
    expect(taskPatchSchema.parse({ plannedFor: "2026-11-17" })).toEqual({ plannedFor: "2026-11-17" });
    expect(taskPatchSchema.parse({ plannedFor: null })).toEqual({ plannedFor: null });
  });

  it("rejects malformed or impossible selection dates", () => {
    for (const plannedFor of ["today", "17/11/2026", "2026-02-30", "0000-01-01", true]) {
      expect(taskPatchSchema.safeParse({ plannedFor }).success).toBe(false);
    }
  });
});

describe("taskSchema", () => {
  it("normalizes legacy estimates in stored tasks and journal snapshots without retaining minutes", () => {
    const task = { title: "Existing task", id: "old", done: false, createdAt: "2026-11-01T12:00:00.000Z", completedAt: null };
    for (const minutes of [1, 90, 525600]) {
      const migrated = storedTaskSchema.parse({ ...task, estimateMinutes: minutes });
      expect(migrated).toMatchObject({ estimateHours: minutes / 60, realTimeHours: null });
      expect(migrated).not.toHaveProperty("estimateMinutes");
    }
    expect(storedTaskSchema.parse({ ...task, estimateMinutes: null }).estimateHours).toBeNull();
    expect(storedTaskSchema.parse({ ...task, estimateHours: null, estimateMinutes: 90 }).estimateHours).toBeNull();
    expect(storedTaskSchema.safeParse({ ...task, estimateMinutes: -1 }).success).toBe(false);
  });

  it("normalizes tasks saved before daily selections existed", () => {
    const task = taskSchema.parse({
      title: "Existing task", id: "old", done: false,
      createdAt: "2026-11-01T12:00:00.000Z", completedAt: null,
    });
    expect(task.plannedFor).toBeNull();
    expect(task.due).toBeNull();
  });
});

describe("task creation defaults", () => {
  it("validates an optional planning day before saving", () => {
    const schema = taskCreationSchema("medium");
    expect(schema.safeParse({ title: "Test", plannedFor: "2026-02-30" }).success).toBe(false);
    expect(schema.parse({ title: "Test", plannedFor: "2026-11-17" })).toMatchObject({ plannedFor: "2026-11-17" });
  });

  it("uses the selected priority only when a task has no explicit priority", () => {
    expect(taskCreationSchema("high").parse({ title: "Default" })).toMatchObject({ priority: "high" });
    expect(taskCreationSchema("high").parse([{ title: "Default" }, { title: "Explicit", priority: "low" }]))
      .toMatchObject([{ priority: "high" }, { priority: "low" }]);
  });
});
