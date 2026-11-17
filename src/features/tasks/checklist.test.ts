import { describe, expect, it } from "vitest";
import { createStep, stepProgress } from "./checklist";
import { taskInputSchema, taskPatchSchema, taskSchema } from "./schema";

describe("checklists", () => {
  it("normalizes older tasks and new tasks to an empty checklist", () => {
    expect(taskInputSchema.parse({ title: "New" }).steps).toEqual([]);
    expect(taskSchema.parse({ title: "Old", id: "old", done: false,
      createdAt: "2026-11-17T12:00:00.000Z", completedAt: null }).steps).toEqual([]);
  });

  it("creates stable, different ids without requiring a secure browser context", () => {
    const first = createStep("  Check draft  ");
    expect(first).toMatchObject({ title: "Check draft", done: false });
    expect(first.id).not.toBe(createStep("Check draft").id);
  });

  it("validates and trims every step, and accepts clearing the list", () => {
    expect(taskPatchSchema.parse({ steps: [{ id: "s1", title: "  First  " }] })).toEqual({
      steps: [{ id: "s1", title: "First", done: false }],
    });
    expect(taskPatchSchema.parse({ steps: [] })).toEqual({ steps: [] });
    for (const steps of [
      [{ id: "s1", title: " " }], [{ id: "", title: "x" }],
      [{ id: "s1", title: "x", done: "yes" }],
      [{ id: "s1", title: "x".repeat(301) }],
      [{ id: "s1", title: "x" }, { id: "s1", title: "y" }],
      Array.from({ length: 101 }, (_, i) => ({ id: `s${i}`, title: "Step" })),
    ]) expect(taskPatchSchema.safeParse({ steps }).success).toBe(false);
  });

  it("counts progress independently of task completion without mutating steps", () => {
    const steps = [{ id: "a", title: "First", done: true }, { id: "b", title: "Second", done: false }];
    expect(stepProgress(steps)).toEqual({ done: 1, total: 2 });
    expect(stepProgress([])).toEqual({ done: 0, total: 0 });
    expect(steps[1].done).toBe(false);
  });
});
