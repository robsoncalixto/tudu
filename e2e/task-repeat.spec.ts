import { doneSection, expect, listTasks, openApp, openSection, row, seed, seedProjects, setLanguage, sidebar, test, TODAY } from "./support";

const languages = [
  { code: "en", repeat: "Repeat", frequency: "Frequency", from: "Scheduled due date", save: "Save repeat rule", remove: "Remove repeat rule", never: "Never", daily: "Daily", weekdays: "Weekdays", weekly: "Weekly", monthly: "Monthly", day: "Day of the month", monday: "Monday", tuesday: "Tuesday", friday: "Friday", done: "Mark as done", reopen: "Mark as open", today: "Today", date: "Due date", cancel: "Cancel", error: "Something went wrong. Try again.", invalid: "A repeating task needs a valid due date.", next: "Next task scheduled for Tomorrow." },
  { code: "pt-BR", repeat: "Repetir", frequency: "Frequência", from: "Prazo programado", save: "Salvar repetição", remove: "Remover repetição", never: "Nunca", daily: "Diariamente", weekdays: "Dias úteis", weekly: "Semanalmente", monthly: "Mensalmente", day: "Dia do mês", monday: "segunda-feira", tuesday: "terça-feira", friday: "sexta-feira", done: "Marcar como concluída", reopen: "Marcar como aberta", today: "Hoje", date: "Prazo", cancel: "Cancelar", error: "Algo deu errado. Tente novamente.", invalid: "Uma tarefa recorrente precisa de um prazo válido.", next: "Próxima tarefa programada para Amanhã." },
];

for (const l of languages) {
  test(`daily completion copies details and resets progress in ${l.code}`, async ({ page, request }) => {
    const [project] = await seedProjects(request, ["Work"]);
    const [original] = await seed(request, [{ title: "Report", due: TODAY, plannedFor: TODAY, notes: "Ask Ana", priority: "high", tags: ["work"], projectId: project.id, steps: [{ id: "draft", title: "Draft", done: true }] }]);
    await openApp(page);
    await setLanguage(page, l.code);
    const task = row(openSection(page), "Report");
    await task.getByText(`${l.repeat}: ${l.never}`, { exact: true }).click();
    await task.getByLabel(l.frequency, { exact: true }).selectOption("daily");
    await expect(task.getByLabel(l.from, { exact: true })).toHaveValue(TODAY);
    await task.getByRole("button", { name: l.save, exact: true }).click();
    await expect(task.getByText(`${l.repeat}: ${l.daily}`, { exact: true })).toBeVisible();
    await sidebar(page).getByRole("button", { name: new RegExp(`^${l.today}`) }).click();
    await task.getByRole("checkbox", { name: l.done, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(l.next);
    await expect(openSection(page).getByRole("listitem")).toHaveCount(0);
    await expect.poll(async () => (await listTasks(request)).length).toBe(2);
    const stored = await listTasks(request);
    const next = stored.find((item) => item.id !== original.id)!;
    expect(next).toMatchObject({ title: "Report", notes: "Ask Ana", priority: "high", tags: ["work"], projectId: project.id, due: "2026-11-18", plannedFor: null, done: false, steps: [{ id: "draft", title: "Draft", done: false }], repeat: { frequency: "daily" }, nextOccurrenceId: null });
    expect(stored.find((item) => item.id === original.id)).toMatchObject({ done: true, nextOccurrenceId: next.id });
    await page.reload();
    await sidebar(page).getByRole("button", { name: /All tasks|Todas as tarefas/ }).click();
    await expect(row(openSection(page), "Report").getByLabel(l.date, { exact: true })).toHaveValue("2026-11-18");
    await doneSection(page).getByText(/Done|Concluídas/).click();
    await row(doneSection(page), "Report").getByRole("checkbox", { name: l.reopen, exact: true }).click();
    const reopened = openSection(page).getByRole("listitem").filter({ has: page.getByLabel(l.date, { exact: true }).and(page.locator('input[value="2026-11-17"]')) });
    await reopened.getByRole("checkbox", { name: l.done, exact: true }).click();
    expect(await listTasks(request)).toHaveLength(2);
  });

  test(`weekly choices, monthly day and rule removal persist in ${l.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Review", due: TODAY }]);
    await openApp(page);
    await setLanguage(page, l.code);
    const task = row(openSection(page), "Review");
    await task.getByText(`${l.repeat}: ${l.never}`, { exact: true }).click();
    await task.getByLabel(l.frequency, { exact: true }).selectOption("weekly");
    await task.getByRole("checkbox", { name: l.tuesday, exact: true }).uncheck();
    await expect(task.getByRole("button", { name: l.save, exact: true })).toBeDisabled();
    await task.getByRole("checkbox", { name: l.monday, exact: true }).check();
    await task.getByRole("checkbox", { name: l.friday, exact: true }).check();
    await task.getByRole("button", { name: l.save, exact: true }).click();
    await task.getByRole("checkbox", { name: l.done, exact: true }).click();
    await expect(task.getByLabel(l.date, { exact: true })).toHaveValue("2026-11-20");
    expect((await listTasks(request))[1]).toMatchObject({ due: "2026-11-20", repeat: { frequency: "weekly", days: [1, 5] } });
    await task.getByText(new RegExp(`^${l.repeat}: ${l.weekly}`)).click();
    await task.getByLabel(l.frequency, { exact: true }).selectOption("weekdays");
    await task.getByRole("button", { name: l.save, exact: true }).click();
    await task.getByRole("checkbox", { name: l.done, exact: true }).click();
    await expect(task.getByLabel(l.date, { exact: true })).toHaveValue("2026-11-23");
    await task.getByText(`${l.repeat}: ${l.weekdays}`, { exact: true }).click();
    await task.getByLabel(l.frequency, { exact: true }).selectOption("monthly");
    await task.getByLabel(l.from, { exact: true }).fill("2027-01-31");
    await task.getByLabel(l.day, { exact: true }).fill("31");
    await task.getByRole("button", { name: l.save, exact: true }).click();
    await task.getByRole("checkbox", { name: l.done, exact: true }).click();
    await expect(task.getByLabel(l.date, { exact: true })).toHaveValue("2027-02-28");
    await page.reload();
    await task.getByText(new RegExp(`^${l.repeat}: ${l.monthly}`)).click();
    await expect(task.getByLabel(l.day, { exact: true })).toHaveValue("31");
    await task.getByRole("button", { name: l.remove, exact: true }).click();
    await expect(task.getByText(`${l.repeat}: ${l.never}`, { exact: true })).toBeVisible();
    await task.getByRole("checkbox", { name: l.done, exact: true }).click();
    await expect(openSection(page).getByRole("listitem")).toHaveCount(0);
    expect(await listTasks(request)).toHaveLength(4);
    expect((await listTasks(request))[3]).toMatchObject({ repeat: null, done: true });
  });

  test(`failed saves and invalid dates preserve the repeat draft in ${l.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Review" }]);
    await openApp(page);
    await setLanguage(page, l.code);
    const task = row(openSection(page), "Review");
    await task.getByText(`${l.repeat}: ${l.never}`, { exact: true }).click();
    await task.getByLabel(l.frequency, { exact: true }).selectOption("monthly");
    await task.getByLabel(l.day, { exact: true }).fill("25");
    await page.route("**/api/tasks/*", (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    await task.getByRole("button", { name: l.save, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(l.error);
    await expect(task.getByLabel(l.day, { exact: true })).toHaveValue("25");
    expect((await listTasks(request))[0]).toMatchObject({ repeat: null, due: null });
    await page.unroute("**/api/tasks/*");
    await task.getByRole("button", { name: l.save, exact: true }).click();
    await expect(task.getByRole("button", { name: l.save, exact: true })).toBeHidden();
    await task.getByLabel(l.date, { exact: true }).fill("");
    await expect(page.getByRole("status")).toContainText(l.invalid);
    await expect(task.getByLabel(l.date, { exact: true })).toHaveValue(TODAY);
    expect((await listTasks(request))[0]).toMatchObject({ repeat: { frequency: "monthly", day: 25 }, due: TODAY });
  });

  test(`completion recovers after a lost response without duplicate tasks in ${l.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Daily", due: TODAY, repeat: { frequency: "daily" } }]);
    await openApp(page);
    await setLanguage(page, l.code);
    await page.route("**/api/tasks/*", async (route) => {
      await route.fetch();
      await route.fulfill({ status: 500, json: { error: "failed" } });
    });
    const task = row(openSection(page), "Daily");
    await task.getByRole("checkbox", { name: l.done, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(l.error);
    await expect(task.getByRole("checkbox", { name: l.done, exact: true })).toHaveAttribute("aria-checked", "false");
    expect(await listTasks(request)).toHaveLength(2);
    await page.unroute("**/api/tasks/*");
    await task.getByRole("checkbox", { name: l.done, exact: true }).click();
    await expect(task.getByLabel(l.date, { exact: true })).toHaveValue("2026-11-18");
    await expect(openSection(page).getByRole("listitem")).toHaveCount(1);
    expect(await listTasks(request)).toHaveLength(2);
  });

  test(`repeat editor fits a phone with keyboard controls in ${l.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Phone task", due: TODAY }]);
    await page.setViewportSize({ width: 320, height: 812 });
    await openApp(page);
    await setLanguage(page, l.code);
    const task = row(openSection(page), "Phone task");
    const summary = task.getByText(`${l.repeat}: ${l.never}`, { exact: true });
    await summary.focus();
    await summary.press("Enter");
    await task.getByLabel(l.frequency, { exact: true }).selectOption("weekly");
    await task.getByRole("button", { name: l.save, exact: true }).focus();
    await expect(task.getByRole("button", { name: l.save, exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await task.getByRole("button", { name: l.cancel, exact: true }).click();
    expect((await listTasks(request))[0].repeat).toBeNull();
  });
}

test("repeat API validates inputs and serializes simultaneous completion", async ({ page, request }) => {
  await openApp(page);
  for (const repeat of [{ frequency: "weekly", days: [] }, { frequency: "monthly", day: 32 }, { frequency: "unknown" }]) {
    expect((await request.post("/api/tasks", { data: { title: "Bad", due: TODAY, repeat } })).status()).toBe(400);
  }
  expect((await request.post("/api/tasks", { data: [{ title: "Good" }, { title: "Bad", repeat: { frequency: "daily" } }] })).status()).toBe(400);
  expect(await listTasks(request)).toHaveLength(0);
  const [task] = await seed(request, [{ title: "Daily", due: TODAY, repeat: { frequency: "daily" } }]);
  const responses = await Promise.all(Array.from({ length: 5 }, () => request.patch(`/api/tasks/${task.id}`, { data: { done: true } })));
  const results = await Promise.all(responses.map((response) => response.json()));
  expect(responses.every((response) => response.ok())).toBe(true);
  expect(new Set(results.map((result) => result.nextTask.id)).size).toBe(1);
  expect(await listTasks(request)).toHaveLength(2);
});
