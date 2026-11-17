import { expect, listTasks, openApp, openSection, doneSection, row, seed, test, TODAY, TOMORROW } from "./support";

test.describe("Board", () => {
  test("shows the app name, today's date and an empty state", async ({ page }) => {
    await openApp(page);

    await expect(page).toHaveTitle("TUDU");
    await expect(page.getByText("Tuesday", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("November 17");
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
    await page.getByRole("textbox", { name: /Write a task/ }).fill("Survive a reload");
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

    await expect(row(page, "A task with a fairly long title")).toBeVisible();
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
      await page.getByRole("button", { name: language.code, exact: true }).click();
      await page.getByRole("complementary").getByRole("button", { name: new RegExp(`^${language.today}`) }).click();
      const task = row(page, "A longer task title");
      const control = task.getByRole("button", { name: language.add });
      await expect(control).toBeInViewport();
      await control.focus();
      await expect(control).toBeFocused();
      await control.press("Enter");
      await expect(task.getByRole("button", { name: language.remove })).toBeInViewport();
      await expect.poll(async () => (await listTasks(request))[0].plannedFor).toBe(TODAY);
      const priority = task.getByRole("button", { name: /Priority:|Prioridade:/ });
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
  await page.getByRole("complementary").getByRole("button", { name: /^Today/ }).click();
  await expect(openSection(page).getByRole("listitem")).toHaveCount(2);
  await page.clock.fastForward(2000);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("November 18");
  await expect(row(openSection(page), "Yesterday's selection")).toHaveCount(0);
  await expect(row(openSection(page), "Deadline")).toBeVisible();
  await expect(row(openSection(page), "Next day")).toBeVisible();
  expect((await listTasks(request))[0].plannedFor).toBe(TODAY);
});

test("refreshes Today when returning to a suspended tab", async ({ page, request }) => {
  await seed(request, [{ title: "Old selection", plannedFor: TODAY }]);
  await openApp(page);
  await page.getByRole("complementary").getByRole("button", { name: /^Today/ }).click();
  await expect(row(page, "Old selection")).toBeVisible();
  await page.clock.setFixedTime(new Date("2026-11-18T10:00:00-03:00"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("November 18");
  await expect(row(page, "Old selection")).toHaveCount(0);
  await expect(page.getByRole("complementary").getByRole("button", { name: /^Today/ })).toHaveText("Today0");
});
