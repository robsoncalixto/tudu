import { expect, listTasks, openApp, openSection, doneSection, row, seed, test, TODAY, YESTERDAY } from "./support";

test.describe("TaskRow", () => {
  test("shows title, notes, due date, priority and tags", async ({ page, request }) => {
    await seed(request, [
      { title: "Prepare the demo", notes: "Use the staging data.", priority: "high", due: TODAY, tags: ["demo", "q4"] },
    ]);
    await openApp(page);
    const task = row(page, "Prepare the demo");

    await expect(task.getByText("Use the staging data.")).toBeVisible();
    await expect(task.getByText("Today", { exact: true })).toBeVisible();
    await expect(task.getByRole("button", { name: "Priority: High" })).toHaveText("High");
    await expect(task.getByRole("button", { name: "#demo" })).toBeVisible();
    await expect(task.getByRole("button", { name: "#q4" })).toBeVisible();
  });

  test("completes a task and reopens it", async ({ page, request }) => {
    await seed(request, [{ title: "Toggle me" }]);
    await openApp(page);

    await row(page, "Toggle me").getByRole("checkbox", { name: "Mark as done" }).click();
    await expect(row(openSection(page), "Toggle me")).toHaveCount(0);
    await expect.poll(async () => (await listTasks(request))[0].done).toBe(true);

    await doneSection(page).locator("summary").click();
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

    await expect(row(page, "New name")).toBeVisible();
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
    await expect(row(page, "Keep me")).toBeVisible();

    await page.getByRole("button", { name: "Keep me" }).click();
    await page.getByRole("textbox", { name: "Edit title" }).fill("   ");
    await page.getByRole("textbox", { name: "Edit title" }).press("Enter");
    await expect(row(page, "Keep me")).toBeVisible();

    expect((await listTasks(request))[0].title).toBe("Keep me");
  });

  test("cycles priority low → medium → high → low", async ({ page, request }) => {
    await seed(request, [{ title: "Rank me", priority: "low" }]);
    await openApp(page);
    const task = row(page, "Rank me");

    await task.getByRole("button", { name: "Priority: Low" }).click();
    await task.getByRole("button", { name: "Priority: Medium" }).click();
    await expect(task.getByRole("button", { name: "Priority: High" })).toBeVisible();
    await expect.poll(async () => (await listTasks(request))[0].priority).toBe("high");

    await task.getByRole("button", { name: "Priority: High" }).click();
    await expect(task.getByRole("button", { name: "Priority: Low" })).toBeVisible();
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
    await doneSection(page).locator("summary").click();
    await expect(row(doneSection(page), "Late").getByText("Yesterday", { exact: true })).toBeVisible();
    await expect(page.getByText("overdue")).toHaveCount(0);
  });

  test("deletes a task", async ({ page, request }) => {
    await seed(request, [{ title: "Remove me" }, { title: "Keep me" }]);
    await openApp(page);

    await row(page, "Remove me").hover();
    await row(page, "Remove me").getByRole("button", { name: "Delete task" }).click();

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

    await row(page, "Unlucky").hover();
    await row(page, "Unlucky").getByRole("button", { name: "Delete task" }).click();
    await expect(row(openSection(page), "Unlucky")).toBeVisible();
    expect((await listTasks(request))[0]).toMatchObject({ title: "Unlucky", done: false });
  });
});

for (const language of [
  { code: "EN", today: "Today", all: "All tasks", add: "Add to today", remove: "Remove from today", error: "Something went wrong. Try again." },
  { code: "PT", today: "Hoje", all: "Todas as tarefas", add: "Adicionar ao dia de hoje", remove: "Remover do dia de hoje", error: "Algo deu errado. Tente novamente." },
]) {
  test(`adds and removes a persisted daily selection in ${language.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Daily pick" }]);
    await openApp(page);
    await page.getByRole("button", { name: language.code, exact: true }).click();
    await row(page, "Daily pick").getByRole("button", { name: language.add, exact: true }).click();
    await expect.poll(async () => (await listTasks(request))[0].plannedFor).toBe(TODAY);
    expect((await listTasks(request))[0].due).toBeNull();
    await page.reload();
    await expect(row(page, "Daily pick").getByRole("button", { name: language.remove })).toHaveAttribute("aria-pressed", "true");
    const navigation = page.getByRole("complementary");
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
    await page.getByRole("button", { name: language.code, exact: true }).click();
    const todayButton = page.getByRole("complementary").getByRole("button", { name: new RegExp(`^${language.today}`) });
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
    await doneSection(page).locator("summary").click();
    await row(doneSection(page), "Deadline pick").getByRole("checkbox").click();
    await expect(todayButton).toHaveText(`${language.today}2`);
    await expect.poll(async () => (await listTasks(request))[0].done).toBe(false);
  });

  test(`recovers from failed selection and removal in ${language.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Retry pick" }]);
    await openApp(page);
    await page.getByRole("button", { name: language.code, exact: true }).click();
    const todayButton = page.getByRole("complementary").getByRole("button", { name: new RegExp(`^${language.today}`) });
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
