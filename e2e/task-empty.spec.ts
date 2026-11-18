import { composer, expect, listTasks, openApp, openSection, seedProjects, setLanguage, sidebar, test, TODAY } from "./support";

for (const lang of [
  { code: "en", today: "Today", search: "Search this list", add: "Add a task", clear: "Clear search", project: "Project", empty: "No matching tasks" },
  { code: "pt-BR", today: "Hoje", search: "Pesquisar nesta lista", add: "Adicionar uma tarefa", clear: "Limpar pesquisa", project: "Projeto", empty: "Nenhuma tarefa encontrada" },
]) {
  test(`adds from an empty view and recovers from an empty search in ${lang.code}`, async ({ page, request }) => {
    const [project] = await seedProjects(request, ["Porto"]);
    await openApp(page); await setLanguage(page, lang.code);
    await sidebar(page).getByRole("button", { name: new RegExp(`^${lang.today}`) }).click();
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
    await openSection(page).getByRole("button", { name: lang.clear }).click();
    await expect(search).toBeFocused();
    await expect(openSection(page).getByRole("listitem", { name: "Check in" })).toBeVisible();
  });
}
