import { describe, expect, it } from "vitest";
import { taskSchema } from "@/features/tasks/schema";
import { addTasksToolSchema, deleteTaskOutputSchema, listTasksOutputSchema, taskUpdateOutputSchema, updateTaskToolSchema } from "./schema";

const task = taskSchema.parse({ id: "t1", title: "Report", done: false, createdAt: "2026-11-01T12:00:00Z", completedAt: null });
describe("MCP tool schemas", () => {
  it("lets new steps omit their id but still validates every step field", () => {
    expect(addTasksToolSchema.parse({ tasks: [{ title: "Report", steps: [{ title: "Draft" }] }] }).tasks[0].steps).toEqual([{ title: "Draft", done: false }]);
    for (const step of [{ title: "" }, { id: "", title: "Draft" }, { title: "Draft", extra: true }]) {
      expect(updateTaskToolSchema.safeParse({ id: "t1", patch: { steps: [step] } }).success).toBe(false);
    }
  });
  it("accepts an optional snapshot of the task as last read", () => {
    expect(updateTaskToolSchema.parse({ id: "t1", patch: { title: "New" }, expected: task }).expected).toEqual(task);
    expect(updateTaskToolSchema.safeParse({ id: "t1", patch: { title: "New" }, expected: { id: "t1" } }).success).toBe(false);
  });
  it("describes the structured results each tool returns", () => {
    expect(listTasksOutputSchema.safeParse({ tasks: [task], total: 1, nextOffset: null }).success).toBe(true);
    expect(listTasksOutputSchema.safeParse({ tasks: [task], total: -1, nextOffset: null }).success).toBe(false);
    expect(taskUpdateOutputSchema.parse({ task })).toEqual({ task, nextTask: null });
    expect(deleteTaskOutputSchema.safeParse({ deleted: false, id: "t1" }).success).toBe(false);
  });
});
