import { composer, expect, listTasks, openApp, openSection, seedProjects, setLanguage, sidebar, test, TODAY } from "./support";

for (const lang of [
  { code: "en", today: "Today", search: "Search this list", add: "Add a task", clear: "Clear search", project: "Project", empty: "No matching tasks",
    keys: "NWrite a new task?Show this help", searchKey: "EscClear the search", sheet: "Keyboard shortcuts", single: "Single-key shortcuts", open: "Shortcuts and syntax" },
  { code: "pt-BR", today: "Hoje", search: "Pesquisar nesta lista", add: "Adicionar uma tarefa", clear: "Limpar pesquisa", project: "Projeto", empty: "Nenhuma tarefa encontrada",
    keys: "NEscrever uma nova tarefa?Mostrar esta ajuda", searchKey: "EscLimpar a pesquisa", sheet: "Atalhos de teclado", single: "Atalhos de uma tecla", open: "Atalhos e sintaxe" },
]) {
  test(`adds from an empty view and recovers from an empty search in ${lang.code}`, async ({ page, request }) => {
    const [project] = await seedProjects(request, ["Porto"]);
    await openApp(page); await setLanguage(page, lang.code);
    await sidebar(page).getByRole("button", { name: new RegExp(`^${lang.today}`) }).click();
    // The empty view teaches the keys that fill it; they come from the shortcut registry.
    const keys = openSection(page).locator(".empty-keys");
    await expect(keys).toHaveText(lang.keys);
    await page.locator("main").focus();
    await page.keyboard.press("n");
    await expect(composer(page)).toBeFocused();
    await page.locator("main").focus();
    await openSection(page).getByRole("button", { name: lang.add, exact: true }).click();
    await expect(composer(page)).toBeFocused();
    await composer(page).fill("Call Ana tomorrow");
    await composer(page).press("Enter");
    await expect(openSection(page).getByRole("listitem", { name: "Call Ana" })).toBeVisible();
    expect((await listTasks(request))[0]).toMatchObject({ due: "2026-11-18", plannedFor: TODAY });
    await sidebar(page).getByRole("button", { name: new RegExp(`^${lang.project}: Porto,`) }).click();
    await composer(page).fill("Check in"); await composer(page).press("Enter");
    await expect(openSection(page).getByRole("listitem", { name: "Check in" })).toBeVisible();
    expect((await listTasks(request)).find((task) => task.title === "Check in")?.projectId).toBe(project.id);
    const search = page.getByRole("searchbox", { name: lang.search });
    await search.fill("something missing");
    await expect(page.getByRole("heading", { name: lang.empty })).toBeVisible();
    await expect(keys).toHaveText(lang.searchKey);
    await openSection(page).getByRole("button", { name: lang.clear }).click();
    await expect(search).toBeFocused();
    await expect(openSection(page).getByRole("listitem", { name: "Check in" })).toBeVisible();
  });

  test(`the empty view stops naming single keys once they are switched off in ${lang.code}`, async ({ page }) => {
    await openApp(page); await setLanguage(page, lang.code);
    const keys = openSection(page).locator(".empty-keys");
    await expect(keys).toHaveText(lang.keys);
    await sidebar(page).getByRole("button", { name: lang.open, exact: true }).click();
    await page.getByRole("dialog", { name: lang.sheet, exact: true }).getByRole("checkbox", { name: lang.single, exact: true }).uncheck();
    await page.keyboard.press("Escape");
    await expect(keys).toHaveCount(0);
    await expect(openSection(page).getByRole("button", { name: lang.add, exact: true })).toBeVisible();
  });
}
