import { beforeEach, describe, expect, it, vi } from "vitest";
import { taskSchema } from "@/features/tasks/schema";
import { createTaskTools, McpToolError, type TaskOperations } from "./tools";

const task = taskSchema.parse({ id: "t1", title: "Report", done: false, createdAt: "2026-11-01T12:00:00Z", completedAt: null });
let operations: TaskOperations;
let tools: ReturnType<typeof createTaskTools>;
beforeEach(() => {
  operations = {
    listTasks: vi.fn(async () => [task]),
    listProjects: vi.fn(async () => []),
    addTasks: vi.fn(async () => [task]),
    updateTask: vi.fn(async () => ({ task, nextTask: null })),
    deleteTask: vi.fn(async () => true),
  };
  tools = createTaskTools(operations);
});
describe("MCP task tools", () => {
  it("lists existing projects through their repository port", async () => {
    expect((await tools.list_projects({})).structuredContent).toEqual({ projects: [] });
    expect(operations.listProjects).toHaveBeenCalledOnce();
    expect((await tools.list_projects({ unexpected: true })).isError).toBe(true);
    expect(operations.listProjects).toHaveBeenCalledOnce();
  });
  it("lists through the repository port and returns structured and text results", async () => {
    const result = await tools.list_tasks({ query: "report" });
    expect(result.structuredContent).toEqual({ tasks: [task], total: 1, nextOffset: null });
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify(result.structuredContent) }]);
    expect(operations.listTasks).toHaveBeenCalledOnce();
  });
  it("adds one or many validated tasks, leaving an absent priority for the server", async () => {
    await tools.add_tasks({ tasks: [{ title: "  Report  " }, { title: "Invoice", priority: "low" }] });
    expect(operations.addTasks).toHaveBeenCalledWith([
      expect.objectContaining({ title: "Report", due: null, tags: [] }), expect.objectContaining({ title: "Invoice", priority: "low" }),
    ]);
    expect(vi.mocked(operations.addTasks).mock.calls[0][0][0]).not.toHaveProperty("priority");
    expect((await tools.add_tasks({ tasks: [] })).isError).toBe(true);
    expect((await tools.add_tasks({ tasks: [{ title: "Bad", id: "injected" }] })).isError).toBe(true);
    expect(operations.addTasks).toHaveBeenCalledOnce();
  });
  it("updates only the requested fields and reports missing tasks", async () => {
    expect((await tools.update_task({ id: task.id, patch: { priority: "high", plannedFor: "2026-11-17" } })).structuredContent).toEqual({ task, nextTask: null });
    expect(operations.updateTask).toHaveBeenCalledWith(task.id, { priority: "high", plannedFor: "2026-11-17" });
    vi.mocked(operations.updateTask).mockResolvedValueOnce(null);
    expect((await tools.update_task({ id: "missing", patch: { title: "New" } })).structuredContent).toEqual({ error: "not_found" });
    expect((await tools.update_task({ id: task.id, patch: {} })).isError).toBe(true);
    expect((await tools.update_task({ id: task.id, patch: { nextOccurrenceId: "override" } })).isError).toBe(true);
  });
  it("completes through the atomic update contract and returns the linked occurrence", async () => {
    const next = { ...task, id: "next" };
    vi.mocked(operations.updateTask).mockResolvedValueOnce({ task: { ...task, done: true }, nextTask: next });
    expect((await tools.complete_task({ id: task.id })).structuredContent).toEqual({ task: { ...task, done: true }, nextTask: next });
    expect(operations.updateTask).toHaveBeenCalledWith(task.id, { done: true });
  });
  it("refuses deletion before touching storage unless confirmation is explicitly true", async () => {
    for (const input of [{ id: task.id }, { id: task.id, confirm: false }, { id: task.id, confirm: "true" }]) {
      expect((await tools.delete_task(input)).isError).toBe(true);
    }
    expect(operations.deleteTask).not.toHaveBeenCalled();
    expect((await tools.delete_task({ id: task.id, confirm: true })).structuredContent).toEqual({ deleted: true, id: task.id });
    vi.mocked(operations.deleteTask).mockResolvedValueOnce(false);
    expect((await tools.delete_task({ id: "missing", confirm: true })).structuredContent).toEqual({ error: "not_found" });
  });
  it("maps known errors and redacts storage failures", async () => {
    vi.mocked(operations.addTasks).mockRejectedValueOnce(new McpToolError("invalid_project"));
    expect((await tools.add_tasks({ tasks: [{ title: "Report" }] })).structuredContent).toEqual({ error: "invalid_project" });
    vi.mocked(operations.updateTask).mockRejectedValueOnce(new McpToolError("invalid_repeat"));
    expect((await tools.complete_task({ id: task.id })).structuredContent).toEqual({ error: "invalid_repeat" });
    vi.mocked(operations.listTasks).mockRejectedValueOnce(new Error("private database credentials"));
    const result = await tools.list_tasks({});
    expect(result.structuredContent).toEqual({ error: "generic" });
    expect(JSON.stringify(result)).not.toContain("credentials");
  });
  it("validates list filters before reading storage", async () => {
    expect((await tools.list_tasks({ limit: -1 })).isError).toBe(true);
    expect(operations.listTasks).not.toHaveBeenCalled();
  });
});
