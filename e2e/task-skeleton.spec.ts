import { expect, openSection, row, saveSettings, seed, test } from "./support";

for (const l of [
  { locale: "en", loading: "Loading…", failed: "Couldn’t load your tasks.", retry: "Retry" },
  { locale: "pt-BR", loading: "Carregando…", failed: "Não foi possível carregar suas tarefas.", retry: "Tentar novamente" },
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
    await expect(row(openSection(page), "First task")).toBeVisible();
  });
}
