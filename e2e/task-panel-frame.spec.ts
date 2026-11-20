import { closeTaskPanel, composer, expect, listTasks, openApp, row, saveSettings, seed, setLanguage, sidebar, taskDetails, taskPanel, test, TODAY } from "./support";

for (const l of [
  { code: "en", priority: "Priority", due: "Due date", planned: "Planned day", today: "Today", search: "Search this list" },
  { code: "pt-BR", priority: "Prioridade", due: "Prazo", planned: "Dia planejado", today: "Hoje", search: "Pesquisar nesta lista" },
]) {
  test(`inspects different tasks alongside the board and restores focus in ${l.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Launch review" }, { title: "Design review" }]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openApp(page);
    await setLanguage(page, l.code);
    const first = row(page, "Launch review");
    const second = row(page, "Design review");
    const panel = taskPanel(page);
    await expect(panel).toBeHidden();
    const search = page.getByRole("searchbox", { name: l.search, exact: true });
    await search.hover();
    await expect(taskDetails(first)).toHaveCSS("opacity", "0");
    await first.hover();
    await expect(taskDetails(first)).toHaveCSS("opacity", "1");
    await first.focus();
    await search.hover();
    await expect(taskDetails(first)).toHaveCSS("opacity", "1");
    await taskDetails(first).click();
    await expect(panel.getByRole("heading", { name: "Launch review", exact: true })).toBeVisible();
    await expect(taskDetails(first)).toHaveAttribute("aria-expanded", "true");
    const priority = panel.getByRole("combobox", { name: l.priority, exact: true });
    await priority.press("ArrowDown");
    await expect(priority.getByRole("option", { name: l.code === "en" ? "Medium" : "Média", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(priority).toBeFocused();
    await expect(panel).toBeVisible();
    const boardBounds = await first.boundingBox();
    const panelBounds = await panel.boundingBox();
    expect(boardBounds!.x + boardBounds!.width).toBeLessThanOrEqual(panelBounds!.x + 1);
    await second.focus();
    await second.press("i");
    await expect(panel.getByRole("heading", { name: "Design review", exact: true })).toBeVisible();
    await expect(taskDetails(first)).toHaveAttribute("aria-expanded", "false");
    await expect(taskDetails(second)).toHaveAttribute("aria-expanded", "true");
    await expect(closeTaskPanel(page)).toBeFocused();
    await closeTaskPanel(page).click();
    await expect(panel).toBeHidden();
    await expect(taskDetails(second)).toBeFocused();
    await first.focus();
    await first.press("i");
    await expect(panel.getByRole("heading", { name: "Launch review", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(taskDetails(first)).toBeFocused();
    await first.press("i");
    await closeTaskPanel(page).press("i");
    await expect(panel).toBeHidden();
    await expect(taskDetails(first)).toBeFocused();
    await composer(page).focus();
    await composer(page).press("i");
    await expect(composer(page)).toHaveValue("i");
    await expect(panel).toBeHidden();
  });

  test(`returns focus to search when the selected task leaves the current view in ${l.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Handle today", plannedFor: TODAY }]);
    await openApp(page);
    await setLanguage(page, l.code);
    await sidebar(page).getByRole("button", { name: new RegExp(`^${l.today},`) }).click();
    const task = row(page, "Handle today");
    await taskDetails(task).click();
    await taskPanel(page).getByLabel(l.planned, { exact: true }).fill("");
    await expect(task).toHaveCount(0);
    await expect.poll(async () => (await listTasks(request))[0].plannedFor).toBeNull();
    await closeTaskPanel(page).click();
    await expect(page.getByRole("searchbox", { name: l.search, exact: true })).toBeFocused();
  });

  test.describe(`phone inspector in ${l.code}`, () => {
    test.use({ hasTouch: true, viewport: { width: 320, height: 760 } });
    test("opens by touch, fits the screen and returns to the same row", async ({ page, request }) => {
      await seed(request, [{ title: "A long task title that wraps on the phone screen" }]);
      await openApp(page);
      await setLanguage(page, l.code);
      const task = row(page, "A long task title that wraps on the phone screen");
      const opener = taskDetails(task);
      await expect(opener).toHaveCSS("opacity", "1");
      await opener.tap({ position: { x: 3, y: 3 } });
      const panel = taskPanel(page);
      await expect(panel.getByRole("heading", { name: "A long task title that wraps on the phone screen" })).toBeVisible();
      const close = closeTaskPanel(page);
      await expect(close).toBeInViewport();
      await expect(close).toBeFocused();
      expect(await panel.evaluate((element) => element.closest("dialog")?.matches(":modal"))).toBe(true);
      await close.press("Tab");
      expect(await panel.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      for (const control of [close, panel.getByRole("combobox", { name: l.priority, exact: true }), panel.getByLabel(l.due, { exact: true })]) {
        const bounds = await control.boundingBox();
        expect(bounds?.width).toBeGreaterThanOrEqual(44);
        expect(bounds?.height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      await panel.getByRole("button", { name: l.code === "en" ? "Delete task" : "Excluir tarefa", exact: true }).scrollIntoViewIfNeeded();
      await expect(close).toBeInViewport();
      await close.tap({ position: { x: 3, y: 3 } });
      await expect(panel).toBeHidden();
      await expect(opener).toBeFocused();
    });
  });
}

for (const l of [
  { locale: "en", resize: "Resize task details" },
  { locale: "pt-BR", resize: "Redimensionar detalhes da tarefa" },
] as const) {
  test(`resizes the panel by drag and keyboard, remembers it and resets in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seed(request, [{ title: "Resizable panel" }]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const task = row(page, "Resizable panel");
    await taskDetails(task).click();
    const panel = page.getByRole("dialog");
    const handle = panel.getByRole("separator", { name: l.resize });
    await expect(handle).toBeVisible();
    const initial = (await panel.boundingBox())!.width;
    const grip = (await handle.boundingBox())!;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2 - 80, grip.y + grip.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => (await panel.boundingBox())!.width).toBeCloseTo(initial + 80, 0);
    await handle.press("ArrowLeft");
    await expect(handle).toBeFocused();
    await expect(handle).toHaveCSS("outline-style", "solid");
    const chosen = (await panel.boundingBox())!.width;
    expect(chosen).toBeCloseTo(initial + 96, 0);

    await page.reload();
    await taskDetails(task).click();
    await expect.poll(async () => (await panel.boundingBox())!.width).toBeCloseTo(chosen, 0);
    await page.setViewportSize({ width: 960, height: 900 });
    await expect(handle).toHaveAttribute("aria-valuenow", "344");
    expect(await page.locator("main").evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(380);
    await page.setViewportSize({ width: 320, height: 760 });
    await expect(handle).toBeHidden();
    await expect.poll(() => panel.evaluate((element) => element.matches(":modal"))).toBe(true);
    expect((await panel.boundingBox())!.width).toBe(320);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect.poll(async () => (await panel.boundingBox())!.width).toBeCloseTo(chosen, 0);
    await handle.dblclick();
    await expect.poll(async () => (await panel.boundingBox())!.width).toBeCloseTo(initial, 0);
    const left = (await handle.boundingBox())!;
    await page.mouse.move(left.x + left.width / 2, left.y + left.height / 2);
    await page.mouse.down();
    await page.mouse.move(left.x - 600, left.y + left.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(panel).toBeVisible();
    await expect(handle).toHaveAttribute("aria-valuenow", "720");
    await handle.press("Enter");
    await expect.poll(async () => (await panel.boundingBox())!.width).toBeCloseTo(initial, 0);
  });
}
