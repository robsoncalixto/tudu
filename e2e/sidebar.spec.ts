import { expect, openApp, openSection, row, rowTitles, seed, seedProjects, sidebar, test, setLanguage } from "./support";

test.describe("Sidebar", () => {
  test("shows the name without a logo and the open-task count", async ({ page, request }) => {
    await seed(request, [{ title: "One" }, { title: "Two" }]);
    await openApp(page);

    await expect(sidebar(page).getByText("TUDU", { exact: true })).toBeVisible();
    await expect(sidebar(page).locator("img, svg")).toHaveCount(0);
    const all = sidebar(page).getByRole("button", { name: /All tasks/ });
    await expect(all).toHaveText("All tasks2");
    await expect(all).toHaveAttribute("aria-current", "page");
  });

  test("hides the tag list when no task has tags", async ({ page, request }) => {
    await seed(request, [{ title: "Plain" }]);
    await openApp(page);

    await expect(sidebar(page).getByText("Tags", { exact: true })).toHaveCount(0);
  });

  test("lists tags of open tasks with counts, sorted by name", async ({ page, request }) => {
    await seed(request, [
      { title: "A", tags: ["work", "alpha"] },
      { title: "B", tags: ["work"] },
    ]);
    await openApp(page);

    await expect(sidebar(page).getByText("Tags", { exact: true })).toBeVisible();
    await expect(sidebar(page).getByRole("button", { name: /^#/ })).toHaveText(["#alpha1", "#work2"]);
  });

  test("filters by tag from the sidebar and back to all tasks", async ({ page, request }) => {
    await seed(request, [
      { title: "Work task", tags: ["work"] },
      { title: "Home task", tags: ["home"] },
      { title: "Loose task" },
    ]);
    await openApp(page);

    await sidebar(page).getByRole("button", { name: "#work" }).click();

    await expect(page.locator("#open-heading")).toHaveText("#work 1");
    expect(await rowTitles(openSection(page))).toEqual(["Work task"]);
    await expect(sidebar(page).getByRole("button", { name: "#work" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("3 open")).toBeVisible();

    await sidebar(page).getByRole("button", { name: /All tasks/ }).click();
    await expect(page.locator("#open-heading")).toHaveText("Open 3");
  });

  test("filters by clicking a tag on a task", async ({ page, request }) => {
    await seed(request, [
      { title: "Home task", tags: ["home"] },
      { title: "Work task", tags: ["work"] },
    ]);
    await openApp(page);

    await row(page, "Home task").getByRole("button", { name: "#home" }).click();

    expect(await rowTitles(openSection(page))).toEqual(["Home task"]);
    await expect(sidebar(page).getByRole("button", { name: "#home" })).toHaveAttribute("aria-current", "page");
  });

  test("keeps the active tag listed after its last open task is done", async ({ page, request }) => {
    await seed(request, [{ title: "Only one", tags: ["solo"] }]);
    await openApp(page);
    await sidebar(page).getByRole("button", { name: "#solo" }).click();

    await row(page, "Only one").getByRole("checkbox").click();

    await expect(page.getByText("No open tasks with this tag.")).toBeVisible();
    await expect(sidebar(page).getByRole("button", { name: "#solo" })).toHaveText("#solo0");
  });

  test("switches the whole interface to Portuguese and back", async ({ page, request }) => {
    await seed(request, [{ title: "Conteúdo do usuário", due: "2026-11-18", tags: ["casa"] }]);
    await openApp(page);

    await sidebar(page).getByRole("link", { name: "Settings", exact: true }).click();
    await page.getByRole("combobox", { name: "Language", exact: true }).selectOption("pt-BR");
    await page.getByRole("button", { name: "Save settings", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Configurações salvas.");
    await page.getByRole("link", { name: "Voltar às tarefas", exact: true }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(page.getByText("terça-feira", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("17 de novembro");
    await expect(page.getByText("1 aberta", { exact: true })).toBeVisible();
    await expect(page.getByText("0 concluídas")).toBeVisible();
    await expect(sidebar(page).getByRole("button", { name: /Todas as tarefas/ })).toBeVisible();
    await expect(sidebar(page).getByText("Etiquetas", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Adicionar", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar com IA" })).toBeVisible();
    await expect(page.getByPlaceholder(/Escreva uma tarefa/)).toBeVisible();
    await expect(page.locator("#open-heading")).toHaveText("Abertas 1");
    const task = row(page, "Conteúdo do usuário");
    await expect(task.getByText("Amanhã")).toBeVisible();
    await expect(task.getByRole("button", { name: "Prioridade: Média" })).toBeVisible();
    await expect(task.getByRole("checkbox", { name: "Marcar como concluída" })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Configurações", exact: true })).toBeVisible();
    await expect(sidebar(page).getByRole("button", { name: "PT", exact: true })).toHaveCount(0);

    await sidebar(page).getByRole("link", { name: "Configurações", exact: true }).click();
    await page.getByRole("combobox", { name: "Idioma", exact: true }).selectOption("en");
    await page.getByRole("button", { name: "Salvar configurações", exact: true }).click();
    await page.getByRole("link", { name: "Back to tasks", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("button", { name: "Add", exact: true })).toBeVisible();
  });

  test("remembers the chosen language after a reload", async ({ page }) => {
    await openApp(page);
    await setLanguage(page, "PT");
    await expect(page.getByRole("button", { name: "Adicionar", exact: true })).toBeVisible();

    await page.evaluate(() => localStorage.setItem("tudu.locale", "en"));
    await page.reload();

    await expect(page.getByRole("button", { name: "Adicionar", exact: true })).toBeVisible();
    await expect(page.getByText("Nada em aberto.")).toBeVisible();
  });
});

for (const language of [
  { code: "EN", today: "Today", all: "All tasks", done: "Done", empty: "Nothing planned for today." },
  { code: "PT", today: "Hoje", all: "Todas as tarefas", done: "Concluídas", empty: "Nada planejado para hoje." },
]) {
  test(`Today navigation and counts in ${language.code}`, async ({ page, request }) => {
    const tasks = await seed(request, [
      { title: "Picked", plannedFor: "2026-11-17", tags: ["work"] },
      { title: "Future picked", plannedFor: "2026-11-17", due: "2026-12-01" },
      { title: "Due now", due: "2026-11-17" },
      { title: "Late", due: "2026-11-16" },
      { title: "Later", due: "2026-11-18", tags: ["work"] },
      { title: "Backlog" },
      { title: "Finished", plannedFor: "2026-11-17" },
    ]);
    await request.patch(`/api/tasks/${tasks[6].id}`, { data: { done: true } });
    await openApp(page);
    await setLanguage(page, language.code);
    const todayButton = sidebar(page).getByRole("button", { name: new RegExp(`^${language.today}`) });
    await expect(todayButton).toHaveText(`${language.today}4`);
    await expect(sidebar(page).getByRole("button", { name: new RegExp(`^${language.all}`) })).toHaveText(`${language.all}6`);
    await todayButton.click();
    await expect(todayButton).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: `${language.today} 4`, exact: true })).toBeVisible();
    expect(await rowTitles(openSection(page))).toEqual(["Late", "Due now", "Future picked", "Picked"]);
    await expect(page.getByText(`${language.done} 1`, { exact: true })).toBeVisible();
    await expect(row(page, "Finished")).toBeHidden();

    await sidebar(page).getByRole("button", { name: "#work" }).click();
    expect(await rowTitles(openSection(page))).toEqual(["Later", "Picked"]);
    await expect(todayButton).toHaveText(`${language.today}4`);
    await sidebar(page).getByRole("button", { name: new RegExp(`^${language.all}`) }).click();
    await expect(openSection(page).getByRole("listitem")).toHaveCount(6);
  });

  test(`Today empty state in ${language.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Unplanned" }, { title: "Old pick", plannedFor: "2026-11-16" }]);
    await openApp(page);
    await setLanguage(page, language.code);
    await sidebar(page).getByRole("button", { name: new RegExp(`^${language.today}`) }).click();
    await expect(page.getByText(language.empty, { exact: true })).toBeVisible();
    await expect(openSection(page).getByRole("listitem")).toHaveCount(0);
  });
}

for (const language of [
  { code: "EN", project: "Project", empty: "No open tasks in this project.", all: "All tasks" },
  { code: "PT", project: "Projeto", empty: "Nenhuma tarefa aberta neste projeto.", all: "Todas as tarefas" },
]) {
  test(`project filters and global open counts in ${language.code}`, async ({ page, request }) => {
    const [acme] = await seedProjects(request, ["Acme", "Empty client"]);
    const tasks = await seed(request, [
      { title: "Client work", projectId: acme.id, tags: ["work"] },
      { title: "Completed work", projectId: acme.id }, { title: "Unassigned work" },
    ]);
    await request.patch(`/api/tasks/${tasks[1].id}`, { data: { done: true } });
    await openApp(page);
    await setLanguage(page, language.code);
    const acmeButton = sidebar(page).getByRole("button", { name: new RegExp(`^${language.project}: Acme,`) });
    await expect(acmeButton).toHaveText("Acme1");
    await acmeButton.click();
    expect(await rowTitles(openSection(page))).toEqual(["Client work"]);
    await expect(acmeButton).toHaveAttribute("aria-current", "page");
    await sidebar(page).getByRole("button", { name: "#work" }).click();
    await expect(acmeButton).toHaveText("Acme1");
    await sidebar(page).getByRole("button", { name: new RegExp(`^${language.project}: Empty client,`) }).click();
    await expect(page.getByText(language.empty, { exact: true })).toBeVisible();
    await sidebar(page).getByRole("button", { name: new RegExp(`^${language.all}`) }).click();
    expect(await rowTitles(openSection(page))).toEqual(["Client work", "Unassigned work"]);
  });
}
