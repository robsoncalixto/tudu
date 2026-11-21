import { composer, expect, listTasks, openSection, row, saveSettings, seed, seedProjects, sidebar, taskDetails, taskPanel, test } from "./support";

for (const l of [
  { locale: "en", all: /^All tasks,/, allLabel: "All tasks", project: /^Project: Outside,/, notes: "Notes", priority: "Priority",
    removed: "That task was deleted elsewhere.", loadFailed: "Couldn’t load your tasks." },
  { locale: "pt-BR", all: /^Todas as tarefas,/, allLabel: "Todas as tarefas", project: /^Projeto: Outside,/, notes: "Anotações", priority: "Prioridade",
    removed: "Essa tarefa foi excluída em outro lugar.", loadFailed: "Não foi possível carregar suas tarefas." },
] as const) {
  test(`refreshes outside changes and preserves local drafts in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    const [first] = await seed(request, [{ title: "Local task", notes: "Saved notes" }]);
    await page.goto("/");
    await taskDetails(row(page, first.title)).click();
    await composer(page).fill("Unsubmitted entry");
    const notes = taskPanel(page).getByRole("textbox", { name: l.notes, exact: true });
    await notes.fill("In-progress notes");
    const [outside] = await seedProjects(request, ["Outside"]);
    await seed(request, [{ title: "Remote task" }]);
    await page.route("**/api/tasks", (route) => route.fulfill({ status: 503, json: { error: "temporary" } }));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(sidebar(page).getByRole("button", { name: l.project })).toBeVisible();
    await expect(row(openSection(page), first.title)).toBeVisible();
    await expect(page.getByText(l.loadFailed, { exact: true })).toHaveCount(0);
    await page.unroute("**/api/tasks");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(row(openSection(page), "Remote task")).toBeVisible();
    await expect(sidebar(page).getByRole("button", { name: l.all })).toHaveText(`${l.allLabel} 2`);
    await expect(composer(page)).toHaveValue("Unsubmitted entry");
    await expect(notes).toHaveValue("In-progress notes");
    await row(openSection(page), first.title).getByRole("combobox", { name: l.priority }).selectOption("high");
    await expect.poll(async () => (await listTasks(request)).find((task) => task.id === first.id)?.priority).toBe("high");
    await request.delete(`/api/tasks/${first.id}`);
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(taskPanel(page)).toBeHidden();
    await expect(page.getByRole("status")).toHaveText(l.removed);
    await expect(composer(page)).toHaveValue("Unsubmitted entry");
    expect((await listTasks(request)).map((task) => task.title)).toEqual(["Remote task"]);
    await sidebar(page).getByRole("button", { name: l.project }).click();
    expect((await request.delete(`/api/projects/${outside.id}`)).status()).toBe(204);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(l.allLabel);
  });
}

test("polls a visible tab and resumes after the tab becomes visible", async ({ page, request }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    let visibility: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", { get: () => visibility });
    window.addEventListener("test-hide-board", () => { visibility = "hidden"; });
    window.addEventListener("test-show-board", () => { visibility = "visible"; });
  });
  await seed(request, [{ title: "Local task" }]);
  await page.goto("/");
  await expect(row(page, "Local task")).toBeVisible();
  let requests = 0;
  await page.route("**/api/tasks", async (route) => { requests++; await route.continue(); });
  await page.evaluate(() => window.dispatchEvent(new Event("test-hide-board")));
  await seed(request, [{ title: "Added while hidden" }]);
  await page.clock.fastForward(20_000);
  expect(requests).toBe(0);
  await expect(row(page, "Added while hidden")).toHaveCount(0);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("test-show-board"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(row(page, "Added while hidden")).toBeVisible();
  await seed(request, [{ title: "Added while visible" }]);
  await page.clock.fastForward(10_000);
  await expect(row(page, "Added while visible")).toBeVisible();
  expect(requests).toBeGreaterThanOrEqual(2);
});

test("applies a pending edit over a fresh board snapshot", async ({ page, request }) => {
  const [task] = await seed(request, [{ title: "Before refresh", priority: "low" }]);
  await page.goto("/");
  let release = () => {};
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let intercepted = false;
  await page.route(`**/api/tasks/${task.id}`, async (route) => {
    intercepted = true;
    await pending;
    await route.continue();
  });
  await row(page, task.title).getByRole("combobox", { name: "Priority" }).selectOption("high");
  try {
    await expect.poll(() => intercepted).toBe(true);
    await request.patch(`/api/tasks/${task.id}`, { data: { title: "Renamed remotely" } });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(row(page, "Renamed remotely").getByRole("combobox", { name: "Priority" })).toHaveValue("high");
  } finally { release(); }
  await expect.poll(async () => (await listTasks(request))[0]).toMatchObject({ title: "Renamed remotely", priority: "high" });
});
