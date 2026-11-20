import { composer, expect, listTasks, openSection, row, saveSettings, seed, test } from "./support";

for (const l of [
  { locale: "en", loading: "Loading…", failed: "Couldn’t load your tasks.", retry: "Retry", search: "Search this list" },
  { locale: "pt-BR", loading: "Carregando…", failed: "Não foi possível carregar suas tarefas.", retry: "Tentar novamente", search: "Pesquisar nesta lista" },
] as const) {
  for (const viewport of [{ width: 1280, height: 860 }, { width: 390, height: 844 }]) {
    test(`the board keeps its place while tasks load at ${viewport.width}px in ${l.locale}`, async ({ page, request }) => {
      await saveSettings(request, { locale: l.locale });
      await seed(request, [{ title: "First task" }, { title: "Second task" }]);
      await page.setViewportSize(viewport);
      let release = () => {};
      const held = new Promise<void>((resolve) => { release = resolve; });
      await page.route("**/api/tasks", async (route) => {
        if (route.request().method() === "GET") await held;
        await route.fallback();
      });
      await page.goto("/");
      const skeleton = page.locator(".task-skeleton");
      await expect(skeleton).toBeVisible();
      await expect(page.getByText(l.loading, { exact: true })).toBeVisible();
      // The placeholders are decoration: the loading text is what is announced.
      await expect(skeleton).toHaveAttribute("aria-hidden", "true");
      const top = async (selector: string) => Math.round((await page.locator(selector).first().boundingBox())!.y);
      const before = { field: await top(".skeleton-entry"), toolbar: await top(".skeleton-toolbar"), list: await top(".skeleton-list") };
      release();
      await expect(row(openSection(page), "First task")).toBeVisible();
      await expect(skeleton).toHaveCount(0);
      await expect(page.getByText(l.loading, { exact: true })).toHaveCount(0);
      expect({ field: await top(".composer-entry"), toolbar: await top(".list-toolbar"), list: await top(".list.card") }).toEqual(before);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    });
  }

  test(`a task started while the list loads lands in the field in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seed(request, [{ title: "First task" }]);
    let release = () => {};
    const held = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/tasks", async (route) => {
      if (route.request().method() === "GET") await held;
      await route.fallback();
    });
    await page.goto("/");
    await expect(page.locator(".task-skeleton")).toBeVisible();
    // The search is on screen from the start, so its shortcut tells when the page is listening to keys.
    const search = page.getByRole("searchbox", { name: l.search });
    await expect(async () => { await page.keyboard.press("/"); await expect(search).toBeFocused({ timeout: 250 }); }).toPass();
    await page.locator("main").focus();
    // The task field is not there yet. Its key is remembered and what follows is kept for it, not run as shortcuts.
    await page.keyboard.press("n");
    await page.keyboard.type("gi dig the garden");
    expect(new URL(page.url()).pathname).toBe("/");
    release();
    await expect(composer(page)).toBeFocused();
    await expect(composer(page)).toHaveValue("gi dig the garden");
    await page.keyboard.press("Enter");
    await expect(row(openSection(page), "gi dig the garden")).toBeVisible();
    expect(await listTasks(request)).toHaveLength(2);
  });

  test(`a failed load replaces the placeholders with a way to retry in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seed(request, [{ title: "First task" }]);
    await page.route("**/api/tasks", (route) => route.request().method() === "GET"
      ? route.fulfill({ status: 500, json: { error: "generic" } }) : route.fallback());
    await page.goto("/");
    await expect(page.getByRole("alert").filter({ hasText: l.failed })).toBeVisible();
    await expect(page.locator(".task-skeleton")).toHaveCount(0);
    await page.unroute("**/api/tasks");
    await page.getByRole("button", { name: l.retry, exact: true }).click();
    // The button goes away with the failure; the keyboard stays on the board.
    await expect(page.locator("main")).toBeFocused();
    await expect(row(openSection(page), "First task")).toBeVisible();
  });
}
