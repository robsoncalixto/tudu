import { expect, openApp, openSection, row, rowTitles, seed, sidebar, test } from "./support";

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

    await sidebar(page).getByRole("button", { name: "PT" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(page.getByText("terça-feira", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("17 de novembro");
    await expect(page.getByText("1 aberta", { exact: true })).toBeVisible();
    await expect(page.getByText("0 concluídas")).toBeVisible();
    await expect(sidebar(page).getByRole("button", { name: /Todas as tarefas/ })).toBeVisible();
    await expect(sidebar(page).getByText("Etiquetas", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Adicionar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar com IA" })).toBeVisible();
    await expect(page.getByPlaceholder(/Escreva uma tarefa/)).toBeVisible();
    await expect(page.locator("#open-heading")).toHaveText("Abertas 1");
    const task = row(page, "Conteúdo do usuário");
    await expect(task.getByText("Amanhã")).toBeVisible();
    await expect(task.getByRole("button", { name: "Prioridade: Média" })).toBeVisible();
    await expect(task.getByRole("checkbox", { name: "Marcar como concluída" })).toBeVisible();
    await expect(sidebar(page).getByRole("button", { name: "PT" })).toHaveAttribute("aria-pressed", "true");

    await sidebar(page).getByRole("button", { name: "EN" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("button", { name: "Add" })).toBeVisible();
  });

  test("remembers the chosen language after a reload", async ({ page }) => {
    await openApp(page);
    await sidebar(page).getByRole("button", { name: "PT" }).click();
    await expect(page.getByRole("button", { name: "Adicionar" })).toBeVisible();

    await page.reload();

    await expect(page.getByRole("button", { name: "Adicionar" })).toBeVisible();
    await expect(page.getByText("Nada em aberto.")).toBeVisible();
  });
});
