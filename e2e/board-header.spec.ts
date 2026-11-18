import { expect, openApp, openSection, row, rowTitles, seed, seedProjects, setLanguage, sidebar, taskRows, test } from "./support";

for (const lang of [
  { code: "en", search: "Search this list", sort: "Sort open tasks", project: "Project", all: "All tasks", progress: "Completion in this list" },
  { code: "pt-BR", search: "Pesquisar nesta lista", sort: "Ordenar tarefas abertas", project: "Projeto", all: "Todas as tarefas", progress: "Conclusão nesta lista" },
]) {
  test(`search, sort and progress follow the selected view in ${lang.code}`, async ({ page, request }) => {
    const [project] = await seedProjects(request, ["Porto"]);
    const tasks = await seed(request, [
      { title: "Early", due: "2026-11-18", priority: "low", projectId: project.id,
        steps: [{ id: "meeting", title: "Agendar discussão técnica", done: false }] },
      { title: "Expedite", notes: "Reunião", priority: "high", projectId: project.id },
      { title: "Signed", notes: "Reunião", projectId: project.id },
      { title: "Unrelated" },
    ]);
    await request.patch(`/api/tasks/${tasks[2].id}`, { data: { done: true } });
    await openApp(page); await setLanguage(page, lang.code);
    await sidebar(page).getByRole("button", { name: new RegExp(`^${lang.project}: Porto,`) }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Porto");
    const progress = page.getByRole("progressbar", { name: lang.progress });
    await expect(progress).toHaveAttribute("value", "1");
    await expect(progress).toHaveAttribute("max", "3");
    expect(await rowTitles(openSection(page))).toEqual(["Early", "Expedite"]);
    await page.getByRole("combobox", { name: lang.sort }).selectOption("priority");
    expect(await rowTitles(openSection(page))).toEqual(["Expedite", "Early"]);
    const search = page.getByRole("searchbox", { name: lang.search });
    await search.fill("discussao tecnica");
    await expect(taskRows(openSection(page))).toHaveCount(1);
    const owner = row(openSection(page), "Early");
    await expect(owner).toBeVisible();
    await expect(owner.getByRole("checkbox", { name: "Agendar discussão técnica", exact: true })).toBeVisible();
    await expect(progress).toHaveAttribute("value", "1");
    await expect(progress).toHaveAttribute("max", "3");
    await search.fill("reuniao");
    await expect(page.getByRole("listitem", { name: "Signed" })).toBeVisible();
    await expect(owner).toHaveCount(0);
    await expect(progress).toHaveAttribute("max", "3");
    await sidebar(page).getByRole("button", { name: new RegExp(`^${lang.all}`) }).click();
    await expect(search).toHaveValue("");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(lang.all);
  });
}
