import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { taskSchema } from "@/features/tasks/schema";
import { isForToday } from "@/features/tasks/selectors";
import { createTaskTools, McpToolError, type TaskOperations } from "./tools";

const task = taskSchema.parse({ id: "t1", title: "Report", done: false, createdAt: "2026-11-01T12:00:00Z", completedAt: null });
const project = { id: "00000000-0000-4000-8000-000000000001", name: "Demo" };
let operations: TaskOperations;
let tools: ReturnType<typeof createTaskTools>;
beforeEach(() => {
  operations = {
    listTasks: vi.fn(async () => [task]),
    readDayOrder: vi.fn(async (day) => ({ day, taskIds: [task.id] })),
    setDayOrder: vi.fn(async ({ day, taskIds }) => ({ day, taskIds })),
    isForToday,
    listProjects: vi.fn(async () => []),
    createProject: vi.fn(async () => project),
    addTasks: vi.fn(async () => [task]),
    updateTask: vi.fn(async () => ({ task, nextTask: null })),
    deleteTask: vi.fn(async () => true),
  };
  tools = createTaskTools(operations);
});
afterEach(() => { vi.restoreAllMocks(); });
describe("MCP task tools", () => {
  it("creates a project through its repository port", async () => {
    expect((await tools.create_project({ name: " Demo " })).structuredContent).toEqual({ project });
    expect(operations.createProject).toHaveBeenCalledWith({ name: "Demo" });
  });

  it.each([{}, { name: " " }, { name: "x".repeat(81) }, { name: 1 }])("rejects malformed project input", async (input) => {
    expect(await tools.create_project(input)).toMatchObject({ isError: true, structuredContent: { error: "invalid_project" } });
    expect(operations.createProject).not.toHaveBeenCalled();
  });

  it("returns a stable duplicate project code", async () => {
    vi.mocked(operations.createProject).mockRejectedValueOnce(new McpToolError("duplicate_project"));
    expect(await tools.create_project({ name: "Demo" })).toMatchObject({ isError: true, structuredContent: { error: "duplicate_project" } });
  });

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
    expect(operations.updateTask).toHaveBeenCalledWith(task.id, { priority: "high", plannedFor: "2026-11-17" }, undefined);
    vi.mocked(operations.updateTask).mockResolvedValueOnce(null);
    expect((await tools.update_task({ id: "missing", patch: { title: "New" } })).structuredContent).toEqual({ error: "not_found" });
    expect((await tools.update_task({ id: task.id, patch: {} })).isError).toBe(true);
    expect((await tools.update_task({ id: task.id, patch: { nextOccurrenceId: "override" } })).isError).toBe(true);
  });
  it("rejects impossible deadlines before calling either write operation", async () => {
    const due = "2026-02-30";
    const failure = { isError: true, structuredContent: { error: "invalid_task" } };
    expect(await tools.add_tasks({ tasks: [{ title: "Report" }, { title: "Bad deadline", due }] })).toMatchObject(failure);
    expect(await tools.update_task({ id: task.id, patch: { due } })).toMatchObject(failure);
    expect(operations.addTasks).not.toHaveBeenCalled();
    expect(operations.updateTask).not.toHaveBeenCalled();
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
  it("assigns ids to new steps, keeps existing ones and rejects duplicates before writing", async () => {
    await tools.add_tasks({ tasks: [{ title: "Report", steps: [{ title: "Draft" }, { id: "keep", title: "Send", done: true }] }] });
    const [[draft]] = vi.mocked(operations.addTasks).mock.calls[0];
    expect(draft.steps).toEqual([{ id: expect.stringMatching(/^[0-9a-f-]{36}$/), title: "Draft", done: false }, { id: "keep", title: "Send", done: true }]);
    await tools.update_task({ id: task.id, patch: { steps: [{ id: "keep", title: "Send" }, { title: "Archive" }] } });
    const [, patch] = vi.mocked(operations.updateTask).mock.calls[0];
    expect(patch.steps).toEqual([{ id: "keep", title: "Send", done: false }, { id: expect.stringMatching(/^[0-9a-f-]{36}$/), title: "Archive", done: false }]);
    expect((await tools.update_task({ id: task.id, patch: { steps: [{ id: "same", title: "A" }, { id: "same", title: "B" }] } })).structuredContent).toEqual({ error: "invalid_task" });
    expect((await tools.add_tasks({ tasks: [{ title: "Report", steps: [{ title: "A", extra: true }] }] })).isError).toBe(true);
    expect(operations.addTasks).toHaveBeenCalledOnce();
    expect(operations.updateTask).toHaveBeenCalledOnce();
  });
  it("forwards the expected snapshot and reports a task changed since it was read", async () => {
    await tools.update_task({ id: task.id, patch: { title: "New" }, expected: task });
    expect(operations.updateTask).toHaveBeenCalledWith(task.id, { title: "New" }, task);
    vi.mocked(operations.updateTask).mockRejectedValueOnce(new McpToolError("task_changed"));
    expect((await tools.update_task({ id: task.id, patch: { title: "New" }, expected: task })).structuredContent).toEqual({ error: "task_changed" });
  });
  it("maps known errors, redacts storage failures and logs only unexpected ones on the server", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(operations.addTasks).mockRejectedValueOnce(new McpToolError("invalid_project"));
    expect((await tools.add_tasks({ tasks: [{ title: "Report" }] })).structuredContent).toEqual({ error: "invalid_project" });
    vi.mocked(operations.updateTask).mockRejectedValueOnce(new McpToolError("invalid_repeat"));
    expect((await tools.complete_task({ id: task.id })).structuredContent).toEqual({ error: "invalid_repeat" });
    expect(log).not.toHaveBeenCalled();
    const failure = new Error("private database credentials");
    vi.mocked(operations.listTasks).mockRejectedValueOnce(failure);
    const result = await tools.list_tasks({});
    expect(result.structuredContent).toEqual({ error: "generic" });
    expect(JSON.stringify(result)).not.toContain("credentials");
    expect(log).toHaveBeenCalledWith("MCP tool list_tasks failed", failure);
  });
  it("validates list filters before reading storage", async () => {
    expect((await tools.list_tasks({ limit: -1 })).isError).toBe(true);
    expect(operations.listTasks).not.toHaveBeenCalled();
  });
});
