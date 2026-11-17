import { describe, expect, it } from "vitest";
import { taskInputSchema, taskPatchSchema } from "./schema";

describe("taskInputSchema", () => {
  it("fills defaults for a title-only task", () => {
    expect(taskInputSchema.parse({ title: "  Call Ana  " })).toEqual({
      title: "Call Ana",
      notes: "",
      priority: "medium",
      due: null,
      tags: [],
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
});
