import { expect, listProjects, listTasks, openApp, row, seed, seedProjects, sidebar, taskDetails, taskPanel, test, setLanguage } from "./support";

const languages = [
  { code: "EN", manage: "Manage projects", newName: "New project", name: "Project name", create: "Create project", save: "Save project", rename: "Rename project: ", remove: "Delete project: ", project: "Project", error: "Something went wrong. Try again.", duplicate: "A project with that name already exists." },
  { code: "PT", manage: "Gerenciar projetos", newName: "Novo projeto", name: "Nome do projeto", create: "Criar projeto", save: "Salvar projeto", rename: "Renomear projeto: ", remove: "Excluir projeto: ", project: "Projeto", error: "Algo deu errado. Tente novamente.", duplicate: "Já existe um projeto com esse nome." },
];
for (const language of languages) {
  test(`creates, renames and deletes projects without deleting tasks in ${language.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Client report", notes: "Keep these notes" }]);
    await openApp(page);
    await setLanguage(page, language.code);
    const manager = page.getByRole("dialog", { name: language.manage, exact: true });
    await sidebar(page).getByRole("button", { name: language.manage, exact: true }).click();
    await manager.getByRole("textbox", { name: language.newName, exact: true }).fill("  Acme  ");
    await manager.getByRole("button", { name: language.create, exact: true }).click();
    await expect(manager.getByRole("textbox", { name: language.newName, exact: true })).toHaveValue("");
    const [project] = await listProjects(request);
    expect(project.name).toBe("Acme");
    await manager.press("Escape");
    const task = row(page, "Client report");
    await taskDetails(task).click();
    await taskPanel(page).getByRole("combobox", { name: language.project, exact: true }).selectOption(project.id);
    await expect.poll(async () => (await listTasks(request))[0].projectId).toBe(project.id);
    await sidebar(page).getByRole("button", { name: new RegExp(`^${language.project}: Acme,`) }).click();
    await expect(page.getByRole("heading", { name: "Acme", exact: true })).toBeVisible();
    await sidebar(page).getByRole("button", { name: language.manage, exact: true }).click();
    await manager.getByRole("button", { name: language.rename + "Acme", exact: true }).click();
    await manager.getByRole("textbox", { name: language.name, exact: true }).fill("Acme Q1");
    await manager.getByRole("button", { name: language.save, exact: true }).click();
    await expect(manager.getByRole("button", { name: language.rename + "Acme Q1" })).toBeEnabled();
    await manager.press("Escape");
    await expect(page.getByRole("heading", { name: "Acme Q1", exact: true })).toBeVisible();
    expect((await listProjects(request))[0]).toEqual({ ...project, name: "Acme Q1" });
    await page.reload();
    await taskDetails(task).click();
    await expect(taskPanel(page).getByRole("combobox", { name: language.project, exact: true })).toHaveValue(project.id);
    await sidebar(page).getByRole("button", { name: new RegExp(`^${language.project}: Acme Q1,`) }).click();
    await sidebar(page).getByRole("button", { name: language.manage, exact: true }).click();
    await manager.getByRole("button", { name: language.remove + "Acme Q1", exact: true }).click();
    await expect.poll(async () => (await listProjects(request)).length).toBe(0);
    await manager.press("Escape");
    await expect(task).toBeVisible();
    await expect.poll(async () => (await listTasks(request))[0].projectId).toBeNull();
    expect((await listTasks(request))[0]).toMatchObject({ title: "Client report", notes: "Keep these notes" });
    await expect(sidebar(page).getByRole("button", { name: new RegExp(`^${language.project}:`) })).toHaveCount(0);
  });

  test(`project failures keep typed names and allow retries in ${language.code}`, async ({ page, request }) => {
    await openApp(page);
    await setLanguage(page, language.code);
    const manager = page.getByRole("dialog", { name: language.manage, exact: true });
    await sidebar(page).getByRole("button", { name: language.manage, exact: true }).click();
    await page.route("**/api/projects", (route) => route.request().method() === "POST"
      ? route.fulfill({ status: 500, json: { error: "failed" } }) : route.fallback());
    await manager.getByRole("textbox", { name: language.newName, exact: true }).fill("Keep this name");
    await manager.getByRole("button", { name: language.create, exact: true }).click();
    await expect(manager.getByRole("status")).toHaveText(language.error);
    await expect(manager.getByRole("textbox", { name: language.newName, exact: true })).toHaveValue("Keep this name");
    expect(await listProjects(request)).toEqual([]);
    await page.unroute("**/api/projects");
    await manager.getByRole("button", { name: language.create, exact: true }).click();
    await expect.poll(async () => (await listProjects(request)).length).toBe(1);
    await page.route("**/api/projects/*", (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    await manager.getByRole("button", { name: language.rename + "Keep this name", exact: true }).click();
    await manager.getByRole("textbox", { name: language.name, exact: true }).fill("Keep this rename");
    await manager.getByRole("button", { name: language.save, exact: true }).click();
    await expect(manager.getByRole("button", { name: language.save, exact: true })).toBeEnabled();
    await expect(manager.getByRole("textbox", { name: language.name, exact: true })).toHaveValue("Keep this rename");
    expect((await listProjects(request))[0].name).toBe("Keep this name");
    await page.unroute("**/api/projects/*");
    await manager.getByRole("button", { name: language.save, exact: true }).click();
    await expect.poll(async () => (await listProjects(request))[0].name).toBe("Keep this rename");
    await page.route("**/api/projects/*", (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    await manager.getByRole("button", { name: language.remove + "Keep this rename", exact: true }).click();
    await expect(manager.getByRole("button", { name: language.remove + "Keep this rename", exact: true })).toBeEnabled();
    expect(await listProjects(request)).toHaveLength(1);
    await page.unroute("**/api/projects/*");
    await manager.getByRole("button", { name: language.remove + "Keep this rename", exact: true }).click();
    await expect.poll(async () => (await listProjects(request)).length).toBe(0);
  });

  test(`Escape cancels a rename and keeps focus in the project dialog in ${language.code}`, async ({ page, request }) => {
    await seedProjects(request, ["Preview"]);
    await openApp(page);
    await setLanguage(page, language.code);
    await sidebar(page).getByRole("button", { name: language.manage }).click();
    const dialog = page.getByRole("dialog", { name: language.manage });
    const edit = dialog.getByRole("button", { name: language.rename + "Preview", exact: true });
    await edit.click();
    const title = dialog.getByRole("textbox", { name: language.name, exact: true });
    await title.fill("Unsaved name");
    await title.press("Escape");
    await expect(edit).toBeFocused();
    await expect(dialog).toBeVisible();
    expect((await listProjects(request)).map((project) => project.name)).toEqual(["Preview"]);
    await edit.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(sidebar(page).getByRole("button", { name: language.manage })).toBeFocused();
  });

  test(`project validation and phone layout in ${language.code}`, async ({ page, request }) => {
    await seedProjects(request, ["Acme"]);
    await page.setViewportSize({ width: 320, height: 900 });
    await openApp(page);
    await setLanguage(page, language.code);
    await sidebar(page).getByRole("button", { name: language.code === "EN" ? "More views" : "Mais visualizações" }).click();
    const manager = page.getByRole("dialog", { name: language.manage, exact: true });
    await sidebar(page).getByRole("button", { name: language.manage, exact: true }).click();
    await expect(manager.getByRole("button", { name: language.create, exact: true })).toBeDisabled();
    for (const control of [
      manager.getByRole("button", { name: language.remove + "Acme", exact: true }),
      manager.getByRole("textbox", { name: language.newName, exact: true }),
      manager.getByRole("button", { name: language.create, exact: true }),
    ]) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
    await manager.getByRole("textbox", { name: language.newName, exact: true }).fill(" acme ");
    await manager.getByRole("button", { name: language.create, exact: true }).click();
    await expect(manager.getByRole("status")).toHaveText(language.duplicate);
    expect(await listProjects(request)).toHaveLength(1);
    await expect(manager.getByRole("textbox", { name: language.newName, exact: true })).toHaveValue(" acme ");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

test("project deletion cannot leave concurrent task creations assigned to a missing project", async ({ page, request }) => {
  const [project] = await seedProjects(request, ["Concurrent project"]);
  await openApp(page);
  const responses = await Promise.all([
    ...Array.from({ length: 6 }, (_, i) => request.post("/api/tasks", { data: { title: `Race ${i}`, projectId: project.id } })),
    request.delete(`/api/projects/${project.id}`),
  ]);
  expect(responses[6].status()).toBe(204);
  expect(responses.slice(0, 6).every((response) => [201, 400].includes(response.status()))).toBe(true);
  const tasks = await listTasks(request);
  expect(tasks).toHaveLength(responses.slice(0, 6).filter((response) => response.status() === 201).length);
  expect(tasks.every((task) => task.projectId === null)).toBe(true);
  expect(await listProjects(request)).toEqual([]);
});
