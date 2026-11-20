import { sidebar, expect, listTasks, openApp, openSection, taskRows, doneSection, row, seed, saveSettings, test, TODAY, TOMORROW, YESTERDAY, setLanguage } from "./support";

test.describe("Board", () => {
  test("shows the app name, today's date and an empty state", async ({ page }) => {
    await openApp(page);

    await expect(page).toHaveTitle("TUDU");
    await expect(page.getByText("Tuesday", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("All tasks");
    await expect(page.locator("header time")).toContainText("November 17");
    await expect(page.getByText("0 open")).toBeVisible();
    await expect(page.getByText("0 done")).toBeVisible();
    await expect(page.getByText("Nothing open.")).toBeVisible();
    await expect(page.getByText("Write the first thing on your mind above.")).toBeVisible();
    await expect(doneSection(page)).toHaveCount(0);
  });

  test("keeps the open and done counts in step with the lists", async ({ page, request }) => {
    await seed(request, [{ title: "First" }, { title: "Second" }, { title: "Third" }]);
    await openApp(page);
    await expect(page.getByText("3 open")).toBeVisible();

    await row(page, "Second").getByRole("checkbox").click();

    await expect(page.getByText("2 open")).toBeVisible();
    await expect(page.getByText("1 done")).toBeVisible();
    await expect(page.locator("#open-heading")).toHaveText("Open 2");
  });

  test("keeps completed tasks in a collapsed Done section", async ({ page, request }) => {
    await seed(request, [{ title: "Ship it" }]);
    await openApp(page);
    await row(page, "Ship it").getByRole("checkbox").click();

    await expect(row(openSection(page), "Ship it")).toHaveCount(0);
    await expect(doneSection(page).locator(":scope > summary")).toHaveText("Done 1");
    await expect(row(doneSection(page), "Ship it")).toBeHidden();

    await doneSection(page).locator(":scope > summary").click();
    await expect(row(doneSection(page), "Ship it")).toBeVisible();
  });

  test("still shows saved tasks after a reload", async ({ page, request }) => {
    await openApp(page);
    await page.getByRole("combobox", { name: /Write a task/ }).fill("Survive a reload");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(row(page, "Survive a reload")).toBeVisible();

    await page.reload();

    await expect(row(page, "Survive a reload")).toBeVisible();
    expect((await listTasks(request)).map((task) => task.title)).toEqual(["Survive a reload"]);
  });

  test("keeps a task's details and done state after a reload", async ({ page, request }) => {
    await seed(request, [{ title: "Plan Q1", notes: "Ask Ana", priority: "high", due: TOMORROW, tags: ["q1", "work"], plannedFor: TODAY }]);
    await openApp(page);
    await row(page, "Plan Q1").getByRole("checkbox", { name: "Mark as done" }).click();
    await expect(page.getByText("1 done")).toBeVisible();

    await page.reload();

    await expect(page.getByText("1 done")).toBeVisible();
    await doneSection(page).locator(":scope > summary").click();
    const task = row(doneSection(page), "Plan Q1");
    await expect(task.getByRole("button", { name: "#q1" })).toBeVisible();
    await expect(task.getByRole("button", { name: "#work" })).toBeVisible();
    await expect(task.getByText("Tomorrow")).toBeVisible();
    expect(await listTasks(request)).toMatchObject([
      { title: "Plan Q1", notes: "Ask Ana", priority: "high", due: TOMORROW, tags: ["q1", "work"], plannedFor: TODAY, done: true },
    ]);
  });

  test("fits a phone screen without horizontal scrolling", async ({ page, request }) => {
    await seed(request, [
      { title: "A task with a fairly long title that has to wrap on a narrow screen", due: TODAY, tags: ["mobile"] },
    ]);
    await page.setViewportSize({ width: 375, height: 812 });
    await openApp(page);

    await expect(row(page, "A task with a fairly long title that has to wrap on a narrow screen")).toBeVisible();
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflows).toBe(false);
    await expect(page.getByRole("button", { name: "Add", exact: true })).toBeInViewport();
  });
});

for (const language of [
  { code: "EN", today: "Today", add: "Add to today", remove: "Remove from today" },
  { code: "PT", today: "Hoje", add: "Adicionar ao dia de hoje", remove: "Remover do dia de hoje" },
]) {
  for (const width of [320, 375]) {
    test(`Today controls fit a ${width}px phone screen in ${language.code}`, async ({ page, request }) => {
      await seed(request, [{ title: "A longer task title for the daily plan", due: TODAY, tags: ["mobile"] }]);
      await page.setViewportSize({ width, height: 812 });
      await openApp(page);
      await setLanguage(page, language.code);
      await sidebar(page).getByRole("button", { name: new RegExp(`^${language.today}`) }).click();
      const task = row(page, "A longer task title for the daily plan");
      const control = task.getByRole("button", { name: language.add });
      // The task field and its chips come first on a phone; the row is a scroll away.
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeInViewport();
      await control.focus();
      await expect(control).toBeFocused();
      await control.press("Enter");
      await expect(task.getByRole("button", { name: language.remove })).toBeInViewport();
      await expect.poll(async () => (await listTasks(request))[0].plannedFor).toBe(TODAY);
      const priority = task.getByRole("combobox", { name: /^(Priority|Prioridade)$/ });
      expect(await priority.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const card = element.closest(".card")!.getBoundingClientRect();
        return bounds.left >= card.left && bounds.right <= card.right;
      })).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    });
  }
}

test("refreshes Today at local midnight without reloading", async ({ page, request }) => {
  await seed(request, [
    { title: "Yesterday's selection", plannedFor: TODAY },
    { title: "Deadline", due: TODAY },
    { title: "Next day", due: "2026-11-18" },
  ]);
  await page.clock.install();
  await page.clock.setSystemTime(new Date("2026-11-17T23:59:59-03:00"));
  await openApp(page);
  await sidebar(page).getByRole("button", { name: /^Today/ }).click();
  await expect(taskRows(openSection(page))).toHaveCount(2);
  await page.clock.fastForward(2000);
  await expect(page.locator("header time")).toContainText("November 18");
  await expect(row(openSection(page), "Yesterday's selection").getByText("Planned earlier · November 17")).toBeVisible();
  await expect(row(openSection(page), "Deadline")).toBeVisible();
  await expect(row(openSection(page), "Next day")).toBeVisible();
  expect((await listTasks(request))[0].plannedFor).toBe(TODAY);
});

test("refreshes Today when returning to a suspended tab", async ({ page, request }) => {
  await seed(request, [{ title: "Old selection", plannedFor: TODAY }]);
  await openApp(page);
  await sidebar(page).getByRole("button", { name: /^Today/ }).click();
  await expect(row(page, "Old selection")).toBeVisible();
  await page.clock.setFixedTime(new Date("2026-11-18T10:00:00-03:00"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("header time")).toContainText("November 18");
  await expect(row(page, "Old selection").getByText("Planned earlier · November 17")).toBeVisible();
  await expect(sidebar(page).getByRole("button", { name: /^Today/ })).toHaveText("Today 1");
});

for (const l of [
  { locale: "en", today: /^Today/, count: "Today 1", planned: "Planned earlier · November 16", remove: "Remove from today" },
  { locale: "pt-BR", today: /^Hoje/, count: "Hoje 1", planned: "Planejada antes · 16 de novembro", remove: "Remover do dia de hoje" },
] as const) {
  test(`keeps unfinished plans in Today until cleared in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seed(request, [{ title: "Carry-over", plannedFor: YESTERDAY }, { title: "Future plan", plannedFor: TOMORROW }]);
    await page.goto("/");
    const today = sidebar(page).getByRole("button", { name: l.today });
    await expect(today).toHaveText(l.count);
    await today.click();
    const carried = row(openSection(page), "Carry-over");
    await expect(carried.getByText(l.planned)).toBeVisible();
    await expect(carried.locator("time")).toHaveAttribute("datetime", YESTERDAY);
    await expect(row(page, "Future plan")).toHaveCount(0);
    await carried.getByRole("button", { name: l.remove }).click();
    await expect(carried).toHaveCount(0);
    await expect.poll(async () => (await listTasks(request)).find((task) => task.title === "Carry-over")?.plannedFor).toBeNull();
  });
}

for (const l of [
  { locale: "en", failed: "Couldn’t load your tasks.", retry: "Retry" },
  { locale: "pt-BR", failed: "Não foi possível carregar suas tarefas.", retry: "Tentar novamente" },
] as const) {
  test(`recovers a failed task list without showing an empty board in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    const [saved] = await seed(request, [{ title: "Previously saved task" }]);
    await page.route("**/api/tasks", (route) => route.fulfill({ status: 503, json: { error: "unavailable" } }));
    await page.goto("/");

    await expect(page.getByText(l.failed, { exact: true })).toBeVisible();
    await expect(openSection(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: l.retry, exact: true })).toBeEnabled();

    await page.unroute("**/api/tasks");
    await page.getByRole("button", { name: l.retry, exact: true }).click();
    await expect(row(openSection(page), saved.title)).toBeVisible();
    await expect(page.getByText(l.failed, { exact: true })).toHaveCount(0);
    expect((await listTasks(request)).map((task) => task.id)).toEqual([saved.id]);
  });
}
