import { dictionaries } from "../src/i18n";
import { pending, seedPlan } from "./agent-support";
import { expect, listTasks, row, seed, seedProjects, sidebar, taskDetails, taskPanel, test, TODAY } from "./support";

for (const locale of ["en", "pt-BR"] as const) {
  const t = dictionaries[locale];
  test(`shows and approves task suggestions beside their fields in ${locale}`, async ({ page, request }) => {
    const [task] = await seed(request, [{ title: "Draft newsletter", steps: [{ id: "step", title: "Gather facts", done: false }] }]);
    const [project] = await seedProjects(request, ["Release"]);
    const reason = locale === "en" ? "Get this ready for release." : "Prepare a tarefa para o lançamento.";
    await seedPlan(request, [
      { kind: "set_priority", taskId: task.id, priority: "high", reason },
      { kind: "set_due", taskId: task.id, due: TODAY, reason },
      { kind: "plan_task", taskId: task.id, plannedFor: TODAY, reason },
      { kind: "set_project", taskId: task.id, projectId: project.id, reason },
      { kind: "add_steps", taskId: task.id, steps: ["Check credits"], reason },
    ], locale);
    await page.goto("/");
    const item = row(page, task.title);
    await expect(item.getByText(t.taskHasSuggestions, { exact: true })).toBeVisible();
    await taskDetails(item).click();
    const panel = taskPanel(page);
    await expect(panel.getByText(t.suggestedValue(t.high), { exact: true })).toBeVisible();
    await expect(panel.getByText(t.suggestedValue(project.name), { exact: true })).toBeVisible();
    await expect(panel.getByText(t.suggestedSubtasks, { exact: true })).toBeVisible();
    await expect(panel.getByText("Check credits", { exact: true })).toBeVisible();
    await expect(panel.getByRole("checkbox", { name: "Check credits" })).toHaveCount(0);
    expect((await listTasks(request))[0]).toMatchObject({ priority: "medium", due: null, projectId: null, plannedFor: null });
    const decisions = panel.getByRole("region", { name: t.agentPending });
    await decisions.getByRole("button", { name: t.agentAccept }).click();
    await expect(item.getByText(t.taskHasSuggestions, { exact: true })).toHaveCount(0);
    await expect.poll(async () => (await listTasks(request))[0]).toMatchObject({
      priority: "high", due: TODAY, projectId: project.id, plannedFor: TODAY,
      steps: [{ title: "Gather facts" }, { title: "Check credits" }],
    });
    await sidebar(page).getByRole("link", { name: t.agent, exact: true }).click();
    await expect(pending(page, locale).getByRole("article")).toHaveCount(0);
    await expect(page.getByRole("region", { name: new RegExp(t.agentHistory) }).getByText(t.agentStatuses.accepted)).toBeVisible();
  });

  test(`keeps a stale suggestion pending until rejected in ${locale}`, async ({ page, request }) => {
    const [task] = await seed(request, [{ title: "Potentially stale" }]);
    await seedPlan(request, [{ kind: "set_priority", taskId: task.id, priority: "high", reason: "Review priority." }], locale);
    await page.goto("/");
    const item = row(page, task.title);
    await expect(item.getByText(t.taskHasSuggestions, { exact: true })).toBeVisible();
    await taskDetails(item).click();
    await request.patch(`/api/tasks/${task.id}`, { data: { notes: "Changed elsewhere." } });
    const decisions = taskPanel(page).getByRole("region", { name: t.agentPending });
    await decisions.getByRole("button", { name: t.agentAccept }).click();
    await expect(decisions.getByRole("alert")).toHaveText(t.errors.agent_stale);
    await expect(item.getByText(t.taskHasSuggestions, { exact: true })).toBeVisible();
    await decisions.getByRole("button", { name: t.agentReject }).click();
    await expect(decisions).toHaveCount(0);
    expect((await listTasks(request))[0]).toMatchObject({ priority: "medium", notes: "Changed elsewhere." });
  });
}
