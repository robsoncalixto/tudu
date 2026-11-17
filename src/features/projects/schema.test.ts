import { describe, expect, it } from "vitest";
import { projectInputSchema, projectNameKey } from "./schema";
import { taskInputSchema, taskPatchSchema } from "@/features/tasks/schema";

const id = "00000000-0000-4000-8000-000000000001";
describe("projects", () => {
  it("trims names and rejects empty or oversized names", () => {
    expect(projectInputSchema.parse({ name: "  Café  " })).toEqual({ name: "Café" });
    expect(projectInputSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(projectInputSchema.safeParse({ name: "x".repeat(81) }).success).toBe(false);
    expect(projectNameKey(" ＡCME ")).toBe(projectNameKey("acme"));
  });
  it("defaults older tasks to no project and accepts assigning or clearing one project", () => {
    expect(taskInputSchema.parse({ title: "Old" }).projectId).toBeNull();
    expect(taskPatchSchema.parse({ projectId: id })).toEqual({ projectId: id });
    expect(taskPatchSchema.parse({ projectId: null })).toEqual({ projectId: null });
    expect(taskPatchSchema.safeParse({ projectId: "unknown" }).success).toBe(false);
    expect(taskPatchSchema.safeParse({ projectId: [id] }).success).toBe(false);
  });
});
