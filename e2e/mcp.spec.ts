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
  for (const tool of tools) expect(tool.outputSchema, tool.name).toMatchObject({ type: "object" });
  expect(tools.find((tool) => tool.name === "update_task")!.inputSchema.properties).toHaveProperty("expected");
  const projects = await seedProjects(request, ["Acme"]);
  expect((await mcp.callTool({ name: "list_projects", arguments: {} })).structuredContent).toEqual({ projects });
});

test("adds, filters, updates, completes and deletes through the real MCP transport", async ({ mcp, request }) => {
  const [project] = await seedProjects(request, ["Acme"]);
  await saveSettings(request, { defaultPriority: "high" });
  const added = await mcp.callTool({ name: "add_tasks", arguments: { tasks: [
    { title: "MCP report", tags: ["work"], projectId: project.id, due: TODAY, estimateHours: 0.5, links: ["https://example.org/report.pdf"] },
    { title: "Second task", priority: "low" },
  ] } });
  expect(added.isError).not.toBe(true);
  const created = z.object({ tasks: z.array(taskSchema) }).parse(added.structuredContent).tasks;
  expect(created).toMatchObject([{ title: "MCP report", priority: "high", projectId: project.id, estimateHours: 0.5, links: ["https://example.org/report.pdf"] },
    { title: "Second task", priority: "low", estimateHours: null, links: [] }]);
  expect(await listTasks(request)).toEqual(created);
  const filtered = await mcp.callTool({ name: "list_tasks", arguments: { state: "open", tag: "work", projectId: project.id, today: TODAY, limit: 1 } });
  expect(filtered.structuredContent).toEqual({ tasks: [created[0]], total: 1, nextOffset: null });
  const patch = { title: "Updated report", notes: "Ask Ana", plannedFor: TODAY, estimateHours: 0.75, links: [] };
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

test("assigns step ids and refuses an update based on a stale read", async ({ mcp, request }) => {
  await mcp.listTools();
  const added = await mcp.callTool({ name: "add_tasks", arguments: { tasks: [{ title: "Checklist", steps: [{ title: "Draft" }, { title: "Send" }] }] } });
  const [created] = z.object({ tasks: z.array(taskSchema) }).parse(added.structuredContent).tasks;
  const [draft, send] = created.steps;
  expect(new Set([draft.id, send.id]).size).toBe(2);
  expect((await listTasks(request))[0].steps).toEqual(created.steps);

  const editedInApp = await request.patch(`/api/tasks/${created.id}`, { data: { steps: [{ ...draft, done: true }, send] } });
  expect(editedInApp.ok()).toBe(true);
  const stale = await mcp.callTool({ name: "update_task", arguments: {
    id: created.id, expected: created, patch: { steps: [draft, send, { title: "Archive" }] },
  } });
  expect(stale.isError).toBe(true);
  expect(stale.structuredContent).toEqual({ error: "task_changed" });
  expect((await listTasks(request))[0].steps).toEqual([{ ...draft, done: true }, send]);

  const [current] = z.object({ tasks: z.array(taskSchema) }).parse((await mcp.callTool({ name: "list_tasks", arguments: {} })).structuredContent).tasks;
  const fresh = await mcp.callTool({ name: "update_task", arguments: {
    id: created.id, expected: current, patch: { steps: [...current.steps, { title: "Archive" }] },
  } });
  const steps = taskUpdateSchema.parse(fresh.structuredContent).task.steps;
  expect(steps).toMatchObject([{ id: draft.id, done: true }, { id: send.id, done: false }, { title: "Archive", done: false }]);
  expect(steps[2].id).not.toBe("");
  expect((await listTasks(request))[0].steps).toEqual(steps);
});

test("completes recurrence atomically, returns the same next task on retries and shares concurrent writes", async ({ mcp, request }) => {
  const [original] = await seed(request, [{ title: "Repeat", due: TODAY, repeat: { frequency: "daily" } }]);
  const first = taskUpdateSchema.parse((await mcp.callTool({ name: "complete_task", arguments: { id: original.id } })).structuredContent);
  const retry = taskUpdateSchema.parse((await mcp.callTool({ name: "complete_task", arguments: { id: original.id } })).structuredContent);
  expect(first.nextTask).toMatchObject({ due: "2026-11-18", done: false });
  expect(retry.nextTask?.id).toBe(first.nextTask?.id);
  expect(await listTasks(request)).toHaveLength(2);
  await mcp.listTools();
  const weekly = await mcp.callTool({ name: "add_tasks", arguments: { tasks: [{ title: "Weekly", due: TODAY, repeat: { frequency: "weekly", days: [5, 1] } }] } });
  expect(weekly.isError).not.toBe(true);
  expect(z.object({ tasks: z.array(taskSchema) }).parse(weekly.structuredContent).tasks[0].repeat).toEqual({ frequency: "weekly", days: [1, 5] });
  await mcp.callTool({ name: "delete_task", arguments: { id: (await listTasks(request)).find((task) => task.title === "Weekly")!.id, confirm: true } });
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

test("allows an authenticated browser client from a configured origin and rejects other ports", async ({ page, request, baseURL }) => {
  const address = new URL(baseURL!);
  // Chromium resolves *.localhost locally; the two names exercise browser CORS against the real server.
  address.hostname = "tudu.localhost";
  const client = new URL(address);
  client.hostname = "client.localhost";
  await page.goto(client.href);
  const data = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
  const endpoint = new URL("/api/mcp", address).href;
  const responses = await page.evaluate(async ({ endpoint, headers, data }) => {
    const options = { method: "POST", body: JSON.stringify(data) };
    const standard = { Accept: headers.Accept, "Content-Type": "application/json", "MCP-Protocol-Version": "2025-11-25" };
    const denied = await fetch(endpoint, { ...options, headers: standard });
    const allowed = await fetch(endpoint, { ...options, headers: { ...standard, Authorization: headers.Authorization } });
    return { denied: denied.status, allowed: allowed.status, body: await allowed.text() };
  }, { endpoint, headers, data });
  expect(responses.denied).toBe(401);
  expect(responses.allowed).toBe(200);
  expect(responses.body).toMatch(/"name"\s*:\s*"list_tasks"/);

  const otherPort = new URL(address);
  otherPort.port = String(Number(address.port) + 1);
  const wrongHost = await request.post("/api/mcp", { headers: { ...headers, Host: otherPort.host, Origin: address.origin }, data });
  const wrongOrigin = await request.post("/api/mcp", { headers: { ...headers, Host: address.host, Origin: otherPort.origin }, data });
  expect(wrongHost.status()).toBe(403);
  expect(wrongOrigin.status()).toBe(403);
});
