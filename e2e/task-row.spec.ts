import { sidebar, closeTaskPanel, expect, listTasks, openApp, openSection, doneSection, row, seed, seedProjects, taskDetails, taskPanel, test, TODAY, YESTERDAY, setLanguage } from "./support";

for (const language of [
  { code: "en", add: "Add subtask", repeat: "Repeat: Never", newStep: "New subtask" },
  { code: "pt-BR", add: "Adicionar subtarefa", repeat: "Repetir: Nunca", newStep: "Nova subtarefa" },
]) {
  test(`opens secondary controls independently of an unfinished subtask in ${language.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Simple task" }]);
    await openApp(page);
    await setLanguage(page, language.code);
    const task = row(openSection(page), "Simple task");
    const details = taskDetails(task);
    await expect(details).toHaveAttribute("aria-expanded", "false");
    await expect(taskPanel(page).getByText(language.repeat, { exact: true })).toBeHidden();
    await task.getByRole("button", { name: language.add, exact: true }).click();
    const newStep = task.getByRole("textbox", { name: language.newStep, exact: true });
    await newStep.fill("Draft step");
    await details.focus();
    await details.press("Enter");
    await expect(details).toHaveAttribute("aria-expanded", "true");
    await expect(taskPanel(page).getByText(language.repeat, { exact: true })).toBeVisible();
    await expect(newStep).toHaveValue("Draft step");
    await details.click();
    await expect(taskPanel(page).getByText(language.repeat, { exact: true })).toBeHidden();
    await expect(newStep).toHaveValue("Draft step");
    expect((await listTasks(request))[0].steps).toEqual([]);
  });
}

for (const l of [
  { code: "en", check: "Mark as done", priority: "Priority", date: "Due date", plan: "Add to today", remove: "Remove from today" },
  { code: "pt-BR", check: "Marcar como concluída", priority: "Prioridade", date: "Prazo", plan: "Adicionar ao dia de hoje", remove: "Remover do dia de hoje" },
]) {
  test(`phone task actions respond across their whole target in ${l.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Schedule review" }]);
    await page.setViewportSize({ width: 320, height: 812 });
    await openApp(page);
    await setLanguage(page, l.code);
    const task = row(openSection(page), "Schedule review");
    const priority = task.getByRole("combobox", { name: l.priority, exact: true });
    const plan = task.getByRole("button", { name: l.plan, exact: true });
    for (const control of [task.getByRole("checkbox", { name: l.check }), priority, task.getByLabel(l.date), plan, taskDetails(task)]) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
    await plan.click({ position: { x: 2, y: 2 } });
    await expect(task.getByRole("button", { name: l.remove, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await listTasks(request))[0].plannedFor).toBe(TODAY);
    await priority.selectOption("high");
    await expect.poll(async () => (await listTasks(request))[0].priority).toBe("high");
    await taskDetails(task).click({ position: { x: 2, y: 2 } });
    await expect(taskPanel(page).getByRole("heading", { name: "Schedule review", exact: true })).toBeVisible();
    await closeTaskPanel(page).click();
    await expect(taskDetails(task)).toHaveAttribute("aria-expanded", "false");
  });
}

test.describe("TaskRow", () => {
  test("shows title, notes, due date, priority and tags", async ({ page, request }) => {
    await seed(request, [
      { title: "Prepare the demo", notes: "Use the staging data.", priority: "high", due: TODAY, tags: ["demo", "q4"] },
    ]);
    await openApp(page);
    const task = row(page, "Prepare the demo");

    await expect(task.getByText("Use the staging data.")).toBeVisible();
    await expect(task.getByText("Today", { exact: true })).toBeVisible();
    await expect(task.getByRole("combobox", { name: "Priority", exact: true })).toHaveValue("high");
    await expect(task.getByRole("button", { name: "#demo" })).toBeVisible();
    await expect(task.getByRole("button", { name: "#q4" })).toBeVisible();
  });

  test("completes a task and reopens it", async ({ page, request }) => {
    await seed(request, [{ title: "Toggle me" }]);
    await openApp(page);

    await row(page, "Toggle me").getByRole("checkbox", { name: "Mark as done" }).click();
    await expect(row(openSection(page), "Toggle me")).toHaveCount(0);
    await expect.poll(async () => (await listTasks(request))[0].done).toBe(true);

    await doneSection(page).locator(":scope > summary").click();
    const done = row(doneSection(page), "Toggle me");
    await expect(done.getByRole("checkbox", { name: "Mark as open" })).toBeChecked();
    await done.getByRole("checkbox").click();

    await expect(row(openSection(page), "Toggle me")).toBeVisible();
    await expect(doneSection(page)).toHaveCount(0);
    await expect.poll(async () => (await listTasks(request))[0].done).toBe(false);
  });

  test("renames a task by clicking its title", async ({ page, request }) => {
    await seed(request, [{ title: "Old name" }]);
    await openApp(page);

    await page.getByRole("button", { name: "Old name" }).click();
    const edit = page.getByRole("textbox", { name: "Edit title" });
    await expect(edit).toBeFocused();
    await edit.fill("New name");
    await edit.press("Enter");

    await expect(row(page, "New name").getByRole("button", { name: "New name", exact: true })).toBeFocused();
    await expect.poll(async () => (await listTasks(request))[0].title).toBe("New name");
  });

  test("saves a rename when the field loses focus", async ({ page, request }) => {
    await seed(request, [{ title: "Blur me" }]);
    await openApp(page);

    await page.getByRole("button", { name: "Blur me" }).click();
    await page.getByRole("textbox", { name: "Edit title" }).fill("Blurred");
    await page.getByRole("heading", { level: 1 }).click();

    await expect(row(page, "Blurred")).toBeVisible();
    await expect.poll(async () => (await listTasks(request))[0].title).toBe("Blurred");
  });

  test("Escape cancels a rename, and an empty name is ignored", async ({ page, request }) => {
    await seed(request, [{ title: "Keep me" }]);
    await openApp(page);

    await page.getByRole("button", { name: "Keep me" }).click();
    await page.getByRole("textbox", { name: "Edit title" }).fill("Discarded");
    await page.getByRole("textbox", { name: "Edit title" }).press("Escape");
    await expect(row(page, "Keep me").getByRole("button", { name: "Keep me", exact: true })).toBeFocused();

    await page.getByRole("button", { name: "Keep me" }).click();
    await page.getByRole("textbox", { name: "Edit title" }).fill("   ");
    await page.getByRole("textbox", { name: "Edit title" }).press("Enter");
    await expect(row(page, "Keep me")).toBeVisible();

    expect((await listTasks(request))[0].title).toBe("Keep me");
  });

  test("chooses any priority directly and restores its saved value on failure", async ({ page, request }) => {
    await seed(request, [{ title: "Rank me", priority: "low" }]);
    await openApp(page);
    const priority = row(page, "Rank me").getByRole("combobox", { name: "Priority", exact: true });
    await priority.selectOption("high");
    await expect.poll(async () => (await listTasks(request))[0].priority).toBe("high");
    await page.route("**/api/tasks/*", (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    await priority.selectOption("medium");
    await expect(page.getByRole("status")).toHaveText("Something went wrong. Try again.");
    await expect(priority).toHaveValue("high");
    expect((await listTasks(request))[0].priority).toBe("high");
    await page.unroute("**/api/tasks/*");
    await priority.selectOption("medium");
    await expect.poll(async () => (await listTasks(request))[0].priority).toBe("medium");
    await priority.selectOption("low");
    await expect.poll(async () => (await listTasks(request))[0].priority).toBe("low");
  });

  test("sets, changes and clears the due date", async ({ page, request }) => {
    await seed(request, [{ title: "Schedule me" }]);
    await openApp(page);
    const task = row(page, "Schedule me");
    await expect(task.getByText("No date")).toBeVisible();

    await task.getByLabel("Due date").fill("2026-11-18");
    await expect(task.getByText("Tomorrow")).toBeVisible();
    await expect.poll(async () => (await listTasks(request))[0].due).toBe("2026-11-18");

    await task.getByLabel("Due date").fill("2026-12-03");
    await expect(task.getByText("Dec 3")).toBeVisible();

    await task.getByLabel("Due date").fill("");
    await expect(task.getByText("No date")).toBeVisible();
    await expect.poll(async () => (await listTasks(request))[0].due).toBeNull();
  });

  test("flags an overdue task, but not once it is done", async ({ page, request }) => {
    await seed(request, [{ title: "Late", due: YESTERDAY }]);
    await openApp(page);

    await expect(row(page, "Late").getByText("Yesterday · overdue")).toBeVisible();

    await row(page, "Late").getByRole("checkbox").click();
    await doneSection(page).locator(":scope > summary").click();
    await expect(row(doneSection(page), "Late").getByText("Yesterday", { exact: true })).toBeVisible();
    await expect(page.getByText("overdue")).toHaveCount(0);
  });

  test("deletes a task", async ({ page, request }) => {
    await seed(request, [{ title: "Remove me" }, { title: "Keep me" }]);
    await openApp(page);

    await taskDetails(row(page, "Remove me")).click();
    await taskPanel(page).getByRole("button", { name: "Delete task" }).click();
    await page.getByRole("dialog", { name: "Delete this task?", exact: true }).getByRole("button", { name: "Delete task", exact: true }).click();

    await expect(row(page, "Remove me")).toHaveCount(0);
    await expect(row(page, "Keep me")).toBeVisible();
    await expect.poll(async () => (await listTasks(request)).map((task) => task.title)).toEqual(["Keep me"]);
  });

  test("undoes a change and shows an error when saving fails", async ({ page, request }) => {
    await seed(request, [{ title: "Unlucky" }]);
    await openApp(page);
    await page.route("**/api/tasks/*", (route) => route.fulfill({ status: 500, json: { error: "boom" } }));

    await row(page, "Unlucky").getByRole("checkbox").click();

    await expect(page.getByRole("status")).toHaveText("Something went wrong. Try again.");
    await expect(row(openSection(page), "Unlucky").getByRole("checkbox", { name: "Mark as done" })).toBeVisible();

    await taskDetails(row(page, "Unlucky")).click();
    await taskPanel(page).getByRole("button", { name: "Delete task" }).click();
    await page.getByRole("dialog", { name: "Delete this task?", exact: true }).getByRole("button", { name: "Delete task", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Delete this task?", exact: true }).getByRole("alert")).toHaveText("Something went wrong. Try again.");
    await expect(row(openSection(page), "Unlucky")).toBeVisible();
    expect((await listTasks(request))[0]).toMatchObject({ title: "Unlucky", done: false });
  });
});

for (const language of [
  { code: "en", confirm: "Delete this task?", cancel: "Cancel", remove: "Delete task", error: "Something went wrong. Try again." },
  { code: "pt-BR", confirm: "Excluir esta tarefa?", cancel: "Cancelar", remove: "Excluir tarefa", error: "Algo deu errado. Tente novamente." },
]) {
  test(`mouse deletion requires confirmation and recovers focus after failure in ${language.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "First task" }, { title: "Second task" }]);
    await openApp(page); await setLanguage(page, language.code);
    const first = row(page, "First task");
    await taskDetails(first).click();
    const remove = taskPanel(page).getByRole("button", { name: language.remove, exact: true });
    await remove.click();
    const dialog = page.getByRole("dialog", { name: language.confirm, exact: true });
    await expect(dialog.getByRole("button", { name: language.cancel, exact: true })).toBeFocused();
    expect(await listTasks(request)).toHaveLength(2);
    await page.keyboard.press("Enter"); await expect(dialog).toBeHidden(); await expect(remove).toBeFocused();
    await remove.click();
    await page.route("**/api/tasks/*", (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    await dialog.getByRole("button", { name: language.remove, exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText(language.error);
    expect(await listTasks(request)).toHaveLength(2);
    await dialog.getByRole("button", { name: language.cancel, exact: true }).click();
    await expect(first).toBeFocused();
    await expect(taskPanel(page).getByRole("heading", { name: "First task", exact: true })).toBeVisible();
    await page.unroute("**/api/tasks/*"); await remove.click();
    await dialog.getByRole("button", { name: language.remove, exact: true }).click();
    await expect(row(page, "Second task")).toBeFocused();
    expect((await listTasks(request)).map((task) => task.title)).toEqual(["Second task"]);
  });
}

for (const language of [
  { code: "EN", today: "Today", all: "All tasks", add: "Add to today", remove: "Remove from today", error: "Something went wrong. Try again." },
  { code: "PT", today: "Hoje", all: "Todas as tarefas", add: "Adicionar ao dia de hoje", remove: "Remover do dia de hoje", error: "Algo deu errado. Tente novamente." },
]) {
  test(`adds and removes a persisted daily selection in ${language.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Daily pick" }]);
    await openApp(page);
    await setLanguage(page, language.code);
    await row(page, "Daily pick").getByRole("button", { name: language.add, exact: true }).click();
    await expect.poll(async () => (await listTasks(request))[0].plannedFor).toBe(TODAY);
    expect((await listTasks(request))[0].due).toBeNull();
    await page.reload();
    await expect(row(page, "Daily pick").getByRole("button", { name: language.remove })).toHaveAttribute("aria-pressed", "true");
    const navigation = sidebar(page);
    await navigation.getByRole("button", { name: new RegExp(`^${language.today}`) }).click();
    await row(page, "Daily pick").getByRole("button", { name: language.remove }).click();
    await expect(row(page, "Daily pick")).toHaveCount(0);
    await expect(navigation.getByRole("button", { name: new RegExp(`^${language.today}`) })).toHaveText(`${language.today}0`);
    await expect.poll(async () => (await listTasks(request))[0].plannedFor).toBeNull();
    await navigation.getByRole("button", { name: new RegExp(`^${language.all}`) }).click();
    await expect(row(page, "Daily pick").getByRole("button", { name: language.add })).toHaveAttribute("aria-pressed", "false");
  });

  test(`keeps due and overdue tasks after removing their selection in ${language.code}`, async ({ page, request }) => {
    await seed(request, [
      { title: "Deadline pick", due: TODAY, plannedFor: TODAY },
      { title: "Late pick", due: YESTERDAY, plannedFor: TODAY },
    ]);
    await openApp(page);
    await setLanguage(page, language.code);
    const todayButton = sidebar(page).getByRole("button", { name: new RegExp(`^${language.today}`) });
    await todayButton.click();
    for (const title of ["Deadline pick", "Late pick"]) {
      await row(page, title).getByRole("button", { name: language.remove }).click();
      await expect(row(page, title).getByRole("button", { name: language.add })).toBeVisible();
    }
    await expect(todayButton).toHaveText(`${language.today}2`);
    await expect.poll(async () => (await listTasks(request)).map((task) => task.plannedFor)).toEqual([null, null]);
    expect((await listTasks(request)).map((task) => task.due)).toEqual([TODAY, YESTERDAY]);
    await row(page, "Deadline pick").getByRole("checkbox").click();
    await expect(todayButton).toHaveText(`${language.today}1`);
    await expect.poll(async () => (await listTasks(request))[0].done).toBe(true);
    await doneSection(page).locator(":scope > summary").click();
    await row(doneSection(page), "Deadline pick").getByRole("checkbox").click();
    await expect(todayButton).toHaveText(`${language.today}2`);
    await expect.poll(async () => (await listTasks(request))[0].done).toBe(false);
  });

  test(`recovers from failed selection and removal in ${language.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Retry pick" }]);
    await openApp(page);
    await setLanguage(page, language.code);
    const todayButton = sidebar(page).getByRole("button", { name: new RegExp(`^${language.today}`) });
    await page.route("**/api/tasks/*", (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    await row(page, "Retry pick").getByRole("button", { name: language.add }).click();
    await expect(page.getByRole("status")).toHaveText(language.error);
    await expect(row(page, "Retry pick").getByRole("button", { name: language.add })).toBeVisible();
    await expect(todayButton).toHaveText(`${language.today}0`);
    expect((await listTasks(request))[0].plannedFor).toBeNull();
    await page.unroute("**/api/tasks/*");
    await row(page, "Retry pick").getByRole("button", { name: language.add }).click();
    await expect.poll(async () => (await listTasks(request))[0].plannedFor).toBe(TODAY);
    await todayButton.click();
    await page.route("**/api/tasks/*", (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    await row(page, "Retry pick").getByRole("button", { name: language.remove }).click();
    await expect(row(page, "Retry pick").getByRole("button", { name: language.remove })).toBeVisible();
    await expect(todayButton).toHaveText(`${language.today}1`);
    expect((await listTasks(request))[0].plannedFor).toBe(TODAY);
    await page.unroute("**/api/tasks/*");
    await row(page, "Retry pick").getByRole("button", { name: language.remove }).click();
    await expect(row(page, "Retry pick")).toHaveCount(0);
    await expect.poll(async () => (await listTasks(request))[0].plannedFor).toBeNull();
  });
}

for (const language of [
  { code: "EN", project: "Project", error: "Something went wrong. Try again." },
  { code: "PT", project: "Projeto", error: "Algo deu errado. Tente novamente." },
]) {
  test(`assigns, switches and clears a task project in ${language.code}`, async ({ page, request }) => {
    const projects = await seedProjects(request, ["Acme", "Beta"]);
    await seed(request, [{ title: "Assignable task" }]);
    await openApp(page);
    await setLanguage(page, language.code);
    await taskDetails(row(page, "Assignable task")).click();
    const select = taskPanel(page).getByRole("combobox", { name: language.project, exact: true });
    await page.route("**/api/tasks/*", (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    await select.selectOption(projects[0].id);
    await expect(page.getByRole("status").filter({ hasText: language.error })).toBeVisible();
    await expect(select).toHaveValue("");
    expect((await listTasks(request))[0].projectId).toBeNull();
    await page.unroute("**/api/tasks/*");
    for (const project of projects) {
      await select.selectOption(project.id);
      await expect.poll(async () => (await listTasks(request))[0].projectId).toBe(project.id);
    }
    await page.reload();
    await taskDetails(row(page, "Assignable task")).click();
    await expect(select).toHaveValue(projects[1].id);
    await select.selectOption("");
    await expect.poll(async () => (await listTasks(request))[0].projectId).toBeNull();
  });
}

for (const firstSave of ["succeeds", "fails"]) {
  test(`keeps later row edits while an earlier save ${firstSave}`, async ({ page, request }) => {
    const [first, other] = await seed(request, [{ title: "Edit twice" }, { title: "Independent task" }]);
    await openApp(page);
    const requests: string[] = [];
    let release = () => {};
    const wait = new Promise<void>((resolve) => { release = resolve; });
    await page.route(`**/api/tasks/${first.id}`, async (route) => {
      const fields = Object.keys(route.request().postDataJSON());
      requests.push(...fields);
      if (fields.includes("priority")) {
        await wait;
        if (firstSave === "fails") return route.fulfill({ status: 500, json: { error: "failed" } });
      }
      return route.continue();
    });
    const firstRow = row(page, first.title);
    const priority = firstRow.getByRole("combobox", { name: "Priority", exact: true });
    const date = firstRow.getByLabel("Due date", { exact: true });
    try {
      await priority.selectOption("high");
      await expect.poll(() => requests).toEqual(["priority"]);
      await date.fill("2026-11-21");
      await expect(date).toHaveValue("2026-11-21");
      await row(page, other.title).getByRole("combobox", { name: "Priority" }).selectOption("low");
      await expect.poll(async () => (await listTasks(request)).find((task) => task.id === other.id)?.priority).toBe("low");
      expect(requests).toEqual(["priority"]);
    } finally {
      release();
    }
    const expected = firstSave === "fails" ? "medium" : "high";
    if (firstSave === "fails") await expect(page.getByRole("status")).toContainText("Try again");
    await expect.poll(async () => (await listTasks(request)).find((task) => task.id === first.id)).toMatchObject({
      priority: expected, due: "2026-11-21",
    });
    await expect(priority).toHaveValue(expected);
    await expect(date).toHaveValue("2026-11-21");
    expect(requests).toEqual(["priority", "due"]);
  });
}

test("deletes after a pending row edit and keeps that edit if deletion fails", async ({ page, request }) => {
  const [task] = await seed(request, [{ title: "Change then remove" }]);
  await openApp(page);
  const methods: string[] = [];
  let release = () => {};
  const wait = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**/api/tasks/${task.id}`, async (route) => {
    methods.push(route.request().method());
    if (route.request().method() === "DELETE") return route.fulfill({ status: 500, json: { error: "failed" } });
    await wait;
    return route.continue();
  });
  const editing = row(page, task.title);
  const dialog = page.getByRole("dialog", { name: "Delete this task?", exact: true });
  try {
    await editing.getByRole("combobox", { name: "Priority" }).selectOption("high");
    await expect.poll(() => methods).toEqual(["PATCH"]);
    await taskDetails(editing).click();
    await taskPanel(page).getByRole("button", { name: "Delete task" }).click();
    await dialog.getByRole("button", { name: "Delete task", exact: true }).click();
    await expect(editing).toHaveCount(0);
    expect(methods).toEqual(["PATCH"]);
  } finally {
    release();
  }
  await expect(dialog.getByRole("alert")).toHaveText("Something went wrong. Try again.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(editing.getByRole("combobox", { name: "Priority" })).toHaveValue("high");
  expect((await listTasks(request))[0]).toMatchObject({ id: task.id, priority: "high" });
  expect(methods).toEqual(["PATCH", "DELETE"]);
});
