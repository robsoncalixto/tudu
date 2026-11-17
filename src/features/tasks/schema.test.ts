import { describe, expect, it } from "vitest";
import { taskInputSchema, taskPatchSchema, taskSchema } from "./schema";

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
    });
  });

  it("rejects a blank title", () => {
    expect(taskInputSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  it("rejects a due date that is not YYYY-MM-DD", () => {
    expect(taskInputSchema.safeParse({ title: "x", due: "17/11/2026" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ title: "x", due: "2026-11-17" }).success).toBe(true);
  });

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
    for (const plannedFor of ["today", "17/11/2026", "2026-02-30", true]) {
      expect(taskPatchSchema.safeParse({ plannedFor }).success).toBe(false);
    }
  });
});

describe("taskSchema", () => {
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
  it("uses the selected priority only when a task has no explicit priority", async () => {
    const { taskCreationSchema } = await import("./schema");
    expect(taskCreationSchema("high").parse({ title: "Default" })).toMatchObject({ priority: "high" });
    expect(taskCreationSchema("high").parse([{ title: "Default" }, { title: "Explicit", priority: "low" }]))
      .toMatchObject([{ priority: "high" }, { priority: "low" }]);
  });
});
