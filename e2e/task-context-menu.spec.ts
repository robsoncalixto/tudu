import { doneSection, row, sidebar, TODAY, TOMORROW, expect, listTasks, saveSettings, seed, test } from "./support";

for (const labels of [
  { locale: "en", menu: "Task actions", add: "Add subtask", input: "New subtask" },
  { locale: "pt-BR", menu: "Ações da tarefa", add: "Adicionar subtarefa", input: "Nova subtarefa" },
] as const) {
  test(`adds a subtask from its parent's context menu in ${labels.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: labels.locale });
    const [first, second] = await seed(request, [{ title: "Design" }, { title: "Release" }]);
    await page.goto("/");
    const parent = page.getByRole("listitem", { name: second.title, exact: true });
    const menu = page.getByRole("menu", { name: labels.menu });
    await parent.focus();
    await page.keyboard.press("Shift+F10");
    await expect(menu.getByRole("menuitem", { name: labels.add })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(parent).toBeFocused();
    await parent.getByRole("button", { name: second.title, exact: true }).click({ button: "right" });
    await menu.getByRole("menuitem", { name: labels.add }).click();
    const entry = parent.getByRole("textbox", { name: labels.input });
    await expect(entry).toBeFocused();
    await entry.fill("Check release notes");
    await entry.press("Enter");
    await expect(parent.getByRole("checkbox", { name: "Check release notes" })).toBeVisible();
    await expect.poll(async () => (await listTasks(request)).find(task => task.id === second.id)?.steps)
      .toMatchObject([{ title: "Check release notes", done: false }]);
    expect((await listTasks(request)).find(task => task.id === first.id)?.steps).toEqual([]);
  });
}

for (const l of [
  { locale: "en", menu: "Task actions", today: /^Today,/, tomorrow: "Plan for tomorrow", nextWeek: "Plan for next week", planned: "Planned for November 18.",
    error: "Something went wrong. Try again.", done: /^Done/, remove: "Delete task", deleted: "Deleted “Future deadline”.", undo: "Undo" },
  { locale: "pt-BR", menu: "Ações da tarefa", today: /^Hoje,/, tomorrow: "Planejar para amanhã", nextWeek: "Planejar para a próxima semana", planned: "Planejada para 18 de novembro.",
    error: "Algo deu errado. Tente novamente.", done: /^Concluídas/, remove: "Excluir tarefa", deleted: "“Future deadline” excluída.", undo: "Desfazer" },
] as const) {
  test(`postpones from the keyboard and restores a failed plan in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    const [planned, due, completed] = await seed(request, [
      { title: "Future deadline", plannedFor: TODAY, due: "2026-12-01" },
      { title: "Due this morning", plannedFor: TODAY, due: TODAY },
      { title: "Already done", plannedFor: TODAY },
    ]);
    await request.patch(`/api/tasks/${completed.id}`, { data: { done: true } });
    await page.goto("/");
    await sidebar(page).getByRole("button", { name: l.today }).click();
    const menu = page.getByRole("menu", { name: l.menu });
    const target = row(page, planned.title);
    const opener = target.getByRole("button", { name: l.menu });
    const tomorrow = menu.getByRole("menuitem", { name: l.tomorrow, exact: true });
    await page.route(`**/api/tasks/${planned.id}`, (route) => route.fulfill({ status: 500, json: { error: "generic" } }));
    await opener.press("Enter");
    await page.keyboard.press("ArrowDown");
    await expect(tomorrow).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toContainText(l.error);
    await expect(target).toBeVisible();
    expect((await listTasks(request)).find((task) => task.id === planned.id)?.plannedFor).toBe(TODAY);
    await page.unroute(`**/api/tasks/${planned.id}`);
    await opener.press("Enter");
    await tomorrow.press("Enter");
    await expect(target).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText(l.planned);
    await expect.poll(async () => (await listTasks(request)).find((task) => task.id === planned.id))
      .toMatchObject({ plannedFor: TOMORROW, due: "2026-12-01" });
    const deadline = row(page, due.title);
    await deadline.getByRole("button", { name: l.menu }).click();
    await menu.getByRole("menuitem", { name: l.nextWeek }).click();
    await expect(deadline).toBeVisible();
    await expect.poll(async () => (await listTasks(request)).find((task) => task.id === due.id))
      .toMatchObject({ plannedFor: "2026-11-23", due: TODAY });
    await doneSection(page).locator("summary").click();
    await row(page, completed.title).getByRole("button", { name: l.menu }).click();
    await expect(menu.getByRole("menuitem", { name: l.tomorrow })).toHaveCount(0);
    await expect(menu.getByRole("menuitem", { name: l.nextWeek })).toHaveCount(0);
    // A finished task can still be deleted from its menu.
    await expect(menu.getByRole("menuitem", { name: l.remove, exact: true })).toBeVisible();
  });

  test(`deletes from the row's menu and takes it back in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seed(request, [{ title: "Future deadline" }, { title: "Stays" }]);
    await page.goto("/");
    const target = row(page, "Future deadline");
    await target.focus();
    await page.keyboard.press("Shift+F10");
    const menu = page.getByRole("menu", { name: l.menu });
    await page.keyboard.press("End");
    await expect(menu.getByRole("menuitem", { name: l.remove, exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(target).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText(l.deleted);
    await expect(row(page, "Stays")).toBeFocused();
    // Nothing is removed while it can still be taken back.
    expect(await listTasks(request)).toHaveLength(2);
    await page.getByRole("status").getByRole("button", { name: l.undo, exact: true }).click();
    await expect(target).toBeFocused();
    // With the pointer, and for good this time.
    await target.hover();
    await target.getByRole("button", { name: l.menu }).click();
    await menu.getByRole("menuitem", { name: l.remove, exact: true }).click();
    await page.getByRole("status").getByRole("button", { name: /^(Dismiss|Dispensar)$/ }).click();
    await expect.poll(async () => (await listTasks(request)).map((task) => task.title)).toEqual(["Stays"]);
  });

  test.describe(`touch task actions in ${l.locale}`, () => {
    test.use({ hasTouch: true, viewport: { width: 320, height: 760 } });
    test("opens the menu and postpones to Monday", async ({ page, request }) => {
      await saveSettings(request, { locale: l.locale });
      const [task] = await seed(request, [{ title: "Phone plan", plannedFor: TODAY }]);
      await page.goto("/");
      const opener = row(page, task.title).getByRole("button", { name: l.menu });
      await opener.tap();
      await expect(opener).toHaveAttribute("aria-expanded", "true");
      await opener.tap();
      await expect(opener).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByRole("menu", { name: l.menu })).toHaveCount(0);
      await opener.tap();
      const item = page.getByRole("menu", { name: l.menu }).getByRole("menuitem", { name: l.nextWeek });
      await expect(item).toBeInViewport();
      expect((await item.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      await item.tap();
      await expect.poll(async () => (await listTasks(request))[0]).toMatchObject({ plannedFor: "2026-11-23", due: null });
    });
  });
}
