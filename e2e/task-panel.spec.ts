import { expect, listTasks, openApp, row, seed, seedProjects, setLanguage, taskDetails, taskPanel, test, TODAY, TOMORROW } from "./support";

const languages = [
  { code: "en", planned: "Planned day", due: "Due date", priority: "Priority", project: "Project",
    subtasks: "Subtasks", add: "Add subtask", input: "New subtask", plan: "Remove from today", retry: "Retry",
    repeat: "Repeat: Never", frequency: "Frequency", monthDay: "Day of the month", friday: "Friday" },
  { code: "pt-BR", planned: "Dia planejado", due: "Prazo", priority: "Prioridade", project: "Projeto",
    subtasks: "Subtarefas", add: "Adicionar subtarefa", input: "Nova subtarefa", plan: "Remover do dia de hoje", retry: "Tentar novamente",
    repeat: "Repetir: Nunca", frequency: "Frequência", monthDay: "Dia do mês", friday: "sexta-feira" },
];

for (const l of languages) {
  test(`saves planning fields and keeps the board in sync in ${l.code}`, async ({ page, request }) => {
    const [project] = await seedProjects(request, ["Release"]);
    const [before] = await seed(request, [{ title: "Plan release" }]);
    await openApp(page);
    await setLanguage(page, l.code);
    const task = row(page, "Plan release");
    const panel = taskPanel(page);
    await taskDetails(task).click();
    const planned = panel.getByLabel(l.planned, { exact: true });
    const due = panel.getByLabel(l.due, { exact: true });
    const priority = panel.getByRole("combobox", { name: l.priority, exact: true });
    const assignment = panel.getByRole("combobox", { name: l.project, exact: true });
    const endpoint = `**/api/tasks/${before.id}`;
    await page.route(endpoint, (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    await planned.fill(TODAY);
    const retry = panel.getByRole("alert").getByRole("button", { name: l.retry, exact: true });
    await expect(retry).toBeVisible();
    await expect(planned).toHaveValue("");
    expect((await listTasks(request))[0].plannedFor).toBeNull();
    await page.unroute(endpoint);
    await retry.click();
    await expect(planned).toHaveValue(TODAY);
    await due.fill(TOMORROW);
    await priority.selectOption("high");
    await assignment.selectOption(project.id);
    await expect.poll(async () => (await listTasks(request))[0]).toMatchObject({
      plannedFor: TODAY, due: TOMORROW, priority: "high", projectId: project.id,
    });
    await expect(task.getByRole("button", { name: l.plan, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(task.getByRole("combobox", { name: l.priority, exact: true })).toHaveValue("high");
    await expect(task.getByLabel(l.due, { exact: true })).toHaveValue(TOMORROW);
    await page.reload();
    await taskDetails(task).click();
    await expect(planned).toHaveValue(TODAY);
    await expect(due).toHaveValue(TOMORROW);
    await expect(assignment).toHaveValue(project.id);
    await planned.fill("");
    await expect.poll(async () => (await listTasks(request))[0].plannedFor).toBeNull();
  });

  test(`creates and checks a subtask from the inspector in ${l.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Launch review" }]);
    await openApp(page);
    await setLanguage(page, l.code);
    const task = row(page, "Launch review");
    const panel = taskPanel(page);
    await taskDetails(task).click();
    const disclosure = panel.getByRole("button", { name: l.subtasks, exact: true });
    await expect(disclosure).toHaveAttribute("aria-expanded", "false");
    await panel.getByRole("button", { name: l.add, exact: true }).click();
    await expect(disclosure).toHaveAttribute("aria-expanded", "true");
    const input = panel.getByRole("textbox", { name: l.input, exact: true });
    await expect(input).toBeFocused();
    await input.fill("Prepare notes");
    await input.press("Enter");
    const child = panel.getByRole("checkbox", { name: "Prepare notes", exact: true });
    await expect(child).toBeVisible();
    await expect(task.getByRole("checkbox", { name: "Prepare notes", exact: true })).toBeVisible();
    await child.check();
    await expect(task.getByRole("checkbox", { name: "Prepare notes", exact: true })).toBeChecked();
    await disclosure.click();
    await expect(child).toBeHidden();
    await expect.poll(async () => (await listTasks(request))[0]).toMatchObject({
      done: false, steps: [{ title: "Prepare notes", done: true }],
    });
  });

  test(`switching tasks preserves each subtask and repeat draft independently in ${l.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Release review", due: TODAY }, { title: "Operations review", due: TODAY }]);
    await openApp(page);
    await setLanguage(page, l.code);
    const release = taskDetails(row(page, "Release review"));
    const operations = taskDetails(row(page, "Operations review"));
    const panel = taskPanel(page);
    const add = panel.getByRole("button", { name: l.add, exact: true });
    const subtask = panel.getByRole("textbox", { name: l.input, exact: true });
    const repeat = panel.getByText(l.repeat, { exact: true });
    const frequency = panel.getByRole("combobox", { name: l.frequency, exact: true });
    const monthDay = panel.getByRole("spinbutton", { name: l.monthDay, exact: true });
    const friday = panel.getByRole("checkbox", { name: l.friday, exact: true });

    await release.click();
    await add.click();
    await subtask.fill("Prepare release notes");
    await repeat.click();
    await frequency.selectOption("monthly");
    await monthDay.fill("23");
    await operations.click();
    await expect(subtask).toBeHidden();
    await expect(frequency).toBeHidden();
    await add.click();
    await subtask.fill("Prepare incident review");
    await repeat.click();
    await frequency.selectOption("weekly");
    await friday.check();

    await release.click();
    await expect(subtask).toHaveValue("Prepare release notes");
    await expect(frequency).toHaveValue("monthly");
    await expect(monthDay).toHaveValue("23");
    await monthDay.press("Escape");
    await expect(frequency).toBeHidden();
    await expect(subtask).toHaveValue("Prepare release notes");
    await operations.click();
    await expect(subtask).toHaveValue("Prepare incident review");
    await expect(frequency).toHaveValue("weekly");
    await expect(friday).toBeChecked();
    expect((await listTasks(request)).map(({ repeat, steps }) => ({ repeat, steps }))).toEqual([
      { repeat: null, steps: [] }, { repeat: null, steps: [] },
    ]);
  });
}
