import { mkdir, rename, rmdir } from "node:fs/promises";
import path from "node:path";
import { dictionaries } from "../src/i18n";
import type { Proposal } from "../src/features/agent/schema";
import { createTask, pending, seedPlan } from "./agent-support";
import { expect, listProjects, listTasks, saveSettings, seed, seedProjects, test, TODAY } from "./support";

for (const locale of ["en", "pt-BR"] as const) {
  const t = dictionaries[locale];
  test(`reviews existing proposals without a configured provider in ${locale}`, async ({ page, request }) => {
    await seedPlan(request, [createTask()], locale);
    await saveSettings(request, { aiProvider: "anthropic" });
    await page.goto("/agent");
    await expect(page.getByRole("button", { name: t.agentPropose, exact: true })).toBeDisabled();
    await pending(page, locale).getByRole("article", { name: "Suggested report", exact: true }).getByRole("button", { name: t.agentAccept, exact: true }).click();
    await expect(page.getByText(t.agentNoPending, { exact: true })).toBeVisible();
    expect((await listTasks(request)).map((task) => task.title)).toEqual(["Suggested report"]);
  });
  test(`approves a grouped day plan and refuses stale changes in ${locale}`, async ({ page, request }) => {
    const [project] = await seedProjects(request, ["Acme"]);
    const [task] = await seed(request, [{ title: "Report", notes: "Preserve", priority: "low", steps: [{ id: "old", title: "Draft", done: true }] }]);
    await seedPlan(request, [
      { kind: "set_priority", taskId: task.id, priority: "high", reason: "Urgent" },
      { kind: "set_due", taskId: task.id, due: "2026-11-20", reason: "Requested date" },
      { kind: "set_project", taskId: task.id, projectId: project.id, reason: "Requested project" },
      { kind: "plan_task", taskId: task.id, plannedFor: TODAY, reason: "Today" },
      { kind: "add_steps", taskId: task.id, steps: ["Review"], reason: "Requested step" },
      { kind: "rename_project", projectId: project.id, name: "Acme Q1", reason: "Requested rename" },
    ], locale);
    await page.goto("/agent"); await expect(pending(page, locale).getByRole("article")).toHaveCount(2);
    await pending(page, locale).getByRole("article", { name: "Acme Q1", exact: true }).getByRole("button", { name: t.agentAccept, exact: true }).click();
    const proposal = pending(page, locale).getByRole("article", { name: "Report", exact: true });
    await proposal.getByRole("button", { name: t.agentAccept, exact: true }).click();
    await expect(page.getByText(t.agentNoPending, { exact: true })).toBeVisible();
    expect((await listTasks(request))[0]).toMatchObject({ title: "Report", notes: "Preserve", priority: "high", due: "2026-11-20", plannedFor: TODAY, projectId: project.id,
      steps: [{ id: "old", title: "Draft", done: true }, { title: "Review", done: false }] });
    await expect(page.getByRole("article", { name: "Report", exact: true }).getByRole("listitem").first())
      .toHaveText(locale === "en" ? "Draft · Done" : "Draft · Concluída");
    expect((await listProjects(request))[0].name).toBe("Acme Q1");
    await seedPlan(request, [{ kind: "set_priority", taskId: task.id, priority: "low", reason: "Another request" }], locale);
    await request.patch(`/api/tasks/${task.id}`, { data: { notes: "Newer human note" } });
    await page.getByRole("button", { name: t.agentRefresh, exact: true }).click();
    await proposal.getByRole("button", { name: t.agentAccept, exact: true }).click();
    await expect(proposal.getByRole("alert")).toHaveText(t.errors.agent_stale);
    expect((await listTasks(request))[0]).toMatchObject({ priority: "high", notes: "Newer human note" });
    await proposal.getByRole("button", { name: t.agentReject, exact: true }).click();
    await expect(page.getByText(t.agentNoPending, { exact: true })).toBeVisible();
  });


}
test("a pending approval is submitted once and the real API protects decided proposals", async ({ page, request }) => {
  const [proposal] = await seedPlan(request, [createTask()]); await page.goto("/agent");
  let release = () => {}; const wait = new Promise<void>((resolve) => { release = resolve; }); let calls = 0;
  await page.route("**/api/agent/proposals/*", async (route) => { calls++; await wait; await route.continue(); });
  const card = pending(page, "en").getByRole("article", { name: "Suggested report", exact: true });
  await card.getByRole("button", { name: "Accept and save", exact: true }).click();
  await expect.poll(() => calls).toBe(1); await page.keyboard.press("Enter");
  await expect(card.getByRole("button", { name: "Reject proposal", exact: true })).toBeDisabled();
  release(); await expect(page.getByText("No proposals waiting for review.", { exact: true })).toBeVisible();
  expect(calls).toBe(1); expect(await listTasks(request)).toHaveLength(1);
  const retry = await request.post(`/api/agent/proposals/${proposal.id}`, { data: { decision: "accept", action: proposal.action } });
  expect(retry.status()).toBe(200); expect(await listTasks(request)).toHaveLength(1);
  expect((await request.post(`/api/agent/proposals/${proposal.id}`, { data: { decision: "reject" } })).status()).toBe(409);
  expect((await request.post(`/api/agent/proposals/${proposal.id}`, { data: { decision: "accept", action: { kind: "update_task", taskId: "forged", patch: { done: true } } } })).status()).toBe(400);
});

for (const locale of ["en", "pt-BR"] as const) {
const t = dictionaries[locale];
test(`an uncertain save can be checked and dismissed without replay in ${locale}`, async ({ page, request }) => {
  const existing = await seed(request, [{ title: "Existing task" }]);
  const projects = await seedProjects(request, ["Existing project"]);
  const [proposal] = await seedPlan(request, [{ kind: "create_project", name: "New client", reason: "Requested project" }], locale); await page.setViewportSize({ width: 320, height: 900 }); await page.goto("/agent");
  await expect(pending(page, locale).getByRole("article", { name: "New client", exact: true })).toBeVisible();
  const dataDir = process.env.TUDU_E2E_DATA_DIR!;
  const file = path.join(dataDir, "projects.json"); const backup = path.join(dataDir, "projects.json.test-backup");
  await rename(file, backup); await mkdir(file);
  try {
    const card = pending(page, locale).getByRole("article", { name: "New client", exact: true });
    await card.getByRole("button", { name: t.agentAccept, exact: true }).click();
    await expect(card).toContainText(t.agentStatuses.applying);
  } finally { await rmdir(file); await rename(backup, file); }
  await page.getByRole("button", { name: t.agentRefresh, exact: true }).click();
  const card = pending(page, locale).getByRole("article", { name: "New client", exact: true });
  await card.getByRole("button", { name: t.agentRecheck, exact: true }).click();
  await expect(card.getByRole("alert")).toHaveText(t.errors.agent_uncertain);
  expect(await listTasks(request)).toEqual(existing);
  await card.getByRole("button", { name: t.agentDismiss, exact: true }).click();
  await expect(page.getByRole("article", { name: "New client", exact: true })).toContainText(t.agentStatuses.unconfirmed);
  const stored = (await (await request.get("/api/agent/proposals")).json()).proposals.find((saved: Proposal) => saved.id === proposal.id);
  expect(stored).toMatchObject({ status: "unconfirmed", approved: proposal.action, result: null });
  expect(await listTasks(request)).toEqual(existing);
  expect(await listProjects(request)).toEqual(projects);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
}
