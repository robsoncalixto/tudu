import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { z } from "zod";
import { taskSchema, taskUpdateSchema } from "../src/features/tasks/schema";
import { expect, listTasks, openApp, saveSettings, seed, seedProjects, test as base, TODAY } from "./support";

const TOKEN = "tudu-e2e-token-not-a-production-secret";
const headers = { Authorization: `Bearer ${TOKEN}`, Accept: "application/json, text/event-stream" };
const test = base.extend<{ mcp: Client }>({
  mcp: async ({ page, baseURL }, use) => {
    await openApp(page);
    const client = new Client({ name: "tudu-e2e", version: "1.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL("/api/mcp", baseURL), { requestInit: { headers } }));
    try { await use(client); } finally { await client.close(); }
  },
});

test("discovers tools with explicit destructive confirmation and reads project ids", async ({ mcp, request }) => {
  const { tools } = await mcp.listTools();
  expect(tools.map((tool) => tool.name).sort()).toEqual(["add_tasks", "complete_task", "delete_task", "list_projects", "list_tasks", "update_task"]);
  const deletion = tools.find((tool) => tool.name === "delete_task")!;
  expect(deletion.annotations?.destructiveHint).toBe(true);
  expect(deletion.description).toMatch(/PERMANENTLY DELETE.*ask the user.*explicit confirmation/);
  expect(deletion.inputSchema.required).toContain("confirm");
  const projects = await seedProjects(request, ["Acme"]);
  expect((await mcp.callTool({ name: "list_projects", arguments: {} })).structuredContent).toEqual({ projects });
});

test("adds, filters, updates, completes and deletes through the real MCP transport", async ({ mcp, request }) => {
  const [project] = await seedProjects(request, ["Acme"]);
  await saveSettings(request, { defaultPriority: "high" });
  const added = await mcp.callTool({ name: "add_tasks", arguments: { tasks: [
    { title: "MCP report", tags: ["work"], projectId: project.id, due: TODAY, estimateMinutes: 30, links: ["https://example.org/report.pdf"] },
    { title: "Second task", priority: "low" },
  ] } });
  expect(added.isError).not.toBe(true);
  const created = z.object({ tasks: z.array(taskSchema) }).parse(added.structuredContent).tasks;
  expect(created).toMatchObject([{ title: "MCP report", priority: "high", projectId: project.id, estimateMinutes: 30, links: ["https://example.org/report.pdf"] },
    { title: "Second task", priority: "low", estimateMinutes: null, links: [] }]);
  expect(await listTasks(request)).toEqual(created);
  const filtered = await mcp.callTool({ name: "list_tasks", arguments: { state: "open", tag: "work", projectId: project.id, today: TODAY, limit: 1 } });
  expect(filtered.structuredContent).toEqual({ tasks: [created[0]], total: 1, nextOffset: null });
  const patch = { title: "Updated report", notes: "Ask Ana", plannedFor: TODAY, estimateMinutes: 45, links: [] };
  const update = await mcp.callTool({ name: "update_task", arguments: { id: created[0].id, patch } });
  expect(taskUpdateSchema.parse(update.structuredContent).task).toMatchObject(patch);
  const done = await mcp.callTool({ name: "complete_task", arguments: { id: created[0].id } });
  expect(taskUpdateSchema.parse(done.structuredContent).task.done).toBe(true);
  expect((await listTasks(request))[0].done).toBe(true);
  const reopened = await mcp.callTool({ name: "update_task", arguments: { id: created[0].id, patch: { done: false } } });
  expect(taskUpdateSchema.parse(reopened.structuredContent).task.done).toBe(false);
  const deleted = await mcp.callTool({ name: "delete_task", arguments: { id: created[0].id, confirm: true } });
  expect(deleted.structuredContent).toEqual({ deleted: true, id: created[0].id });
  expect((await listTasks(request)).map((task) => task.id)).toEqual([created[1].id]);
});

test("completes recurrence atomically, returns the same next task on retries and shares concurrent writes", async ({ mcp, request }) => {
  const [original] = await seed(request, [{ title: "Repeat", due: TODAY, repeat: { frequency: "daily" } }]);
  const first = taskUpdateSchema.parse((await mcp.callTool({ name: "complete_task", arguments: { id: original.id } })).structuredContent);
  const retry = taskUpdateSchema.parse((await mcp.callTool({ name: "complete_task", arguments: { id: original.id } })).structuredContent);
  expect(first.nextTask).toMatchObject({ due: "2026-11-18", done: false });
  expect(retry.nextTask?.id).toBe(first.nextTask?.id);
  expect(await listTasks(request)).toHaveLength(2);
  await Promise.all([
    mcp.callTool({ name: "add_tasks", arguments: { tasks: [{ title: "From MCP" }] } }),
    request.post("/api/tasks", { data: { title: "From REST" } }),
  ]);
  expect((await listTasks(request)).map((task) => task.title).sort()).toEqual(["From MCP", "From REST", "Repeat", "Repeat"]);
});

test("returns stable domain errors and preserves tasks after failures", async ({ mcp, request }) => {
  const invalidProject = await mcp.callTool({ name: "add_tasks", arguments: { tasks: [{ title: "Bad project", projectId: "00000000-0000-4000-8000-000000000001" }] } });
  expect(invalidProject.isError).toBe(true);
  expect(invalidProject.structuredContent).toEqual({ error: "invalid_project" });
  const missing = await mcp.callTool({ name: "complete_task", arguments: { id: "missing" } });
  expect(missing.structuredContent).toEqual({ error: "not_found" });
  const invalidRepeat = await mcp.callTool({ name: "add_tasks", arguments: { tasks: [{ title: "Bad repeat", repeat: { frequency: "daily" } }] } });
  expect(invalidRepeat.structuredContent).toEqual({ error: "invalid_repeat" });
  expect(await listTasks(request)).toEqual([]);
  const recovered = await mcp.callTool({ name: "add_tasks", arguments: { tasks: [{ title: "Recovered" }] } });
  expect(recovered.isError).not.toBe(true);
  expect((await listTasks(request))[0].title).toBe("Recovered");
});

test("legacy protocol rejects unconfirmed deletion and invalid fields before any write", async ({ page, request }) => {
  await openApp(page);
  const [task] = await seed(request, [{ title: "Keep" }]);
  for (const args of [{ id: task.id }, { id: task.id, confirm: false }]) {
    const response = await request.post("/api/mcp", { headers: { ...headers, "MCP-Protocol-Version": "2025-11-25" }, data: {
      jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "delete_task", arguments: args },
    } });
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toMatch(/Invalid|invalid|confirm/);
    expect(await listTasks(request)).toHaveLength(1);
  }
  const response = await request.post("/api/mcp", { headers: { ...headers, "MCP-Protocol-Version": "2025-11-25" }, data: {
    jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "update_task", arguments: { id: task.id, patch: { nextOccurrenceId: "forged" } } },
  } });
  expect(await response.text()).toMatch(/Invalid|invalid|nextOccurrenceId/);
  expect((await listTasks(request))[0]).toMatchObject({ title: "Keep", nextOccurrenceId: null });
});

test("HTTP access rejects missing credentials and untrusted origins, and limits request size", async ({ page, request }) => {
  await openApp(page);
  expect((await request.post("/api/mcp", { data: {} })).status()).toBe(401);
  expect((await request.post("/api/mcp", { headers: { ...headers, Origin: "https://evil.example" }, data: {} })).status()).toBe(403);
  expect((await request.post("/api/mcp", { headers: { ...headers, Host: "evil.example" }, data: {} })).status()).toBe(403);
  expect((await request.post("/api/mcp", { headers, data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: { padding: "a".repeat(1_048_577) } } })).status()).toBe(413);
  expect(await listTasks(request)).toEqual([]);
});
