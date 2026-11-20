import { createTask, fixture, pending } from "./agent-support";
import { dictionaries } from "../src/i18n";
import { composer, expect, listProjects, openApp, openSection, row, rowTitles, saveSettings, seed, seedProjects, sidebar, taskRows, test, setLanguage, TODAY } from "./support";

for (const locale of ["en", "pt-BR"] as const) {
  const t = dictionaries[locale];
  for (const theme of ["light", "dark"] as const) {
    test(`displays the Two Beats wordmark on the ${theme} board in ${locale}`, async ({ page, request }) => {
      await saveSettings(request, { locale, theme });
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const logo = sidebar(page).getByRole("img", { name: "TUDU", exact: true });
      await expect(logo).toBeInViewport();
      await expect(logo).toHaveAttribute("src", "/brand/tudu-logo-on-dark.svg");
      await expect(logo).toHaveJSProperty("complete", true);
      expect(await logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    });
  }

  test(`project and tag groups collapse independently and survive reload in ${locale}`, async ({ page, request }) => {
    const [project] = await seedProjects(request, ["Acme"]);
    await seed(request, [{ title: "Prepare report", projectId: project.id, tags: ["work"] }]);
    await saveSettings(request, { locale });
    await page.goto("/");
    const rail = sidebar(page);
    const projects = rail.getByRole("button", { name: t.projects, exact: true });
    const tags = rail.getByRole("button", { name: t.tags, exact: true });
    const acme = rail.getByRole("button", { name: `${t.project}: Acme, ${t.countOpen(1)}` });
    const work = rail.getByRole("button", { name: "#work" });
    await acme.click();
    await projects.press("Space");
    await expect(acme).toBeHidden();
    await expect(projects).toHaveAttribute("aria-current", "true");
    await expect(projects).toHaveAccessibleDescription("Acme");
    await expect(work).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Acme");
    await page.reload();
    await expect(projects).toHaveAttribute("aria-expanded", "false");
    await tags.click();
    await expect(work).toBeHidden();
    await projects.press("Enter");
    await expect(acme).toBeVisible();
    await expect(tags).toHaveAttribute("aria-expanded", "false");
  });

  test(`compact navigation keeps projects accessible and expands at phone width in ${locale}`, async ({ page, request }) => {
    await seedProjects(request, ["Acme"]);
    await saveSettings(request, { locale });
    await page.goto("/");
    const rail = sidebar(page);
    const projects = rail.getByRole("button", { name: t.projects, exact: true });
    const shrink = rail.getByRole("button", { name: t.collapseSidebar, exact: true });
    const grow = rail.getByRole("button", { name: t.expandSidebar, exact: true });
    const width = (await rail.boundingBox())!.width;
    await shrink.click();
    await expect(grow).toBeFocused();
    await expect(rail.locator('img[src="/brand/tudu-icon.svg"]')).toBeInViewport();
    await grow.press("Enter");
    await expect(shrink).toBeFocused();
    await expect(rail.getByRole("img", { name: "TUDU", exact: true })).toHaveAttribute("src", "/brand/tudu-logo-on-dark.svg");
    await shrink.press("Space");
    await expect(projects).toHaveAttribute("aria-expanded", "false");
    expect((await rail.boundingBox())!.width).toBeLessThan(width);
    await page.reload();
    await expect(grow).toBeVisible();
    await projects.press("Enter");
    await expect(projects).toHaveAttribute("aria-expanded", "true");
    const acme = rail.getByRole("button", { name: new RegExp(`^${t.project}: Acme,`) });
    await acme.click();
    await expect(acme).toHaveAttribute("aria-current", "page");
    await shrink.click();
    await page.setViewportSize({ width: 320, height: 800 });
    const wordmark = rail.getByRole("img", { name: "TUDU", exact: true });
    await expect(wordmark).toBeInViewport();
    await expect(wordmark).toHaveAttribute("src", "/brand/tudu-logo-on-dark.svg");
    const more = rail.getByRole("button", { name: t.moreViews, exact: true });
    await more.click();
    await expect(grow).toBeHidden();
    await expect(acme).toBeVisible();
    await acme.click();
    await expect(more).toBeFocused();
    await expect(more).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });

  test(`the Projects plus creates directly from a collapsed group in ${locale}`, async ({ page, request }) => {
    await seedProjects(request, ["Existing"]);
    await saveSettings(request, { locale });
    await page.goto("/");
    const rail = sidebar(page);
    const projects = rail.getByRole("button", { name: t.projects, exact: true });
    await projects.click();
    const create = rail.getByRole("button", { name: t.newProject, exact: true });
    await create.click();
    const dialog = page.getByRole("dialog", { name: t.newProject, exact: true });
    const field = dialog.getByRole("textbox", { name: t.newProject, exact: true });
    await expect(field).toBeFocused();
    await field.fill("Existing");
    await field.press("Enter");
    await expect(dialog.getByRole("status")).toHaveText(t.errors.duplicate_project);
    await expect(field).toHaveValue("Existing");
    await expect(field).toBeFocused();
    await field.fill("Launch");
    await field.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(create).toBeFocused();
    await expect(projects).toHaveAttribute("aria-expanded", "true");
    const link = rail.getByRole("button", { name: new RegExp(`^${t.project}: Launch,`) });
    await link.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Launch");
    expect((await listProjects(request)).map((project) => project.name)).toEqual(["Existing", "Launch"]);
  });
}

for (const language of [
  { code: "en", settings: "Settings", today: "Today" },
  { code: "pt-BR", settings: "Configurações", today: "Hoje" },
]) {
  test(`Settings returns to the active list, search, sort and draft in ${language.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Review agenda", due: "2026-11-17" }]);
    await openApp(page);
    await setLanguage(page, language.code);
    await sidebar(page).getByRole("button", { name: new RegExp(`^${language.today}`) }).click();
    await page.getByRole("searchbox").fill("agenda");
    const sort = page.getByRole("combobox", { name: /Sort open tasks|Ordenar tarefas abertas/ });
    await sort.selectOption("priority");
    await composer(page).fill("Private draft");
    await sidebar(page).getByRole("link", { name: language.settings }).click();
    await expect(page).toHaveURL("/settings");
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(language.today);
    await expect(page.getByRole("searchbox")).toHaveValue("agenda");
    await expect(sort).toHaveValue("priority");
    await expect(composer(page)).toHaveValue("Private draft");
    await expect(page).toHaveURL("/");
  });
}

for (const language of [
  { code: "en", all: "All tasks", today: "Today", settings: "Settings", agent: "Assistant", workLog: "Work log", more: "More views" },
  { code: "pt-BR", all: "Todas as tarefas", today: "Hoje", settings: "Configurações", agent: "Assistente", workLog: "Resumo diário", more: "Mais visualizações" },
]) {
  test(`phone navigation exposes both primary views and settings in ${language.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Plan", due: "2026-11-17" }]);
    await page.setViewportSize({ width: 320, height: 800 });
    await openApp(page);
    await setLanguage(page, language.code);
    const navigation = await sidebar(page).getByRole("navigation").boundingBox();
    for (const label of [language.all, language.today]) {
      const item = sidebar(page).getByRole("button", { name: new RegExp(`^${label}`) });
      const box = await item.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(320);
      expect(box!.x + box!.width).toBeLessThanOrEqual(navigation!.x + navigation!.width);
      await item.click();
      await expect(item).toHaveAttribute("aria-current", "page");
    }
    const more = sidebar(page).getByLabel(language.more, { exact: true });
    await more.click();
    await expect(sidebar(page).getByRole("link", { name: language.agent, exact: true })).toBeInViewport();
    await expect(sidebar(page).getByRole("link", { name: language.workLog, exact: true })).toBeInViewport();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("listitem", { name: "Plan", exact: true })).not.toBeFocused();
    await page.keyboard.press("Escape"); await expect(more).toBeFocused();
    await sidebar(page).getByRole("link", { name: language.settings, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(language.settings);
  });
  test(`phone secondary navigation opens the assistant in ${language.code}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await openApp(page); await setLanguage(page, language.code);
    await sidebar(page).getByLabel(language.more, { exact: true }).click();
    await sidebar(page).getByRole("link", { name: language.agent, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(language.agent);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

test.describe("Sidebar", () => {
  test("uses the Two Beats icon as the browser favicon", async ({ page, request }) => {
    await openApp(page);
    const icon = page.locator('head link[rel~="icon"][href="/brand/tudu-icon.svg"]');
    await expect(icon).toHaveAttribute("type", "image/svg+xml");
    const response = await request.get("/brand/tudu-icon.svg");
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/svg+xml");
    expect(await response.text()).toContain("<svg");
  });

  test("shows the open-task count", async ({ page, request }) => {
    await seed(request, [{ title: "One" }, { title: "Two" }]);
    await openApp(page);

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

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("#work");
    await expect(page.locator("#open-heading")).toHaveText("Open 1");
    expect(await rowTitles(openSection(page))).toEqual(["Work task"]);
    await expect(sidebar(page).getByRole("button", { name: "#work" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("1 open")).toBeVisible();

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
    await sidebar(page).getByRole("button", { name: /^Todas as tarefas,/ }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(page.getByText("terça-feira", { exact: true })).toBeVisible();
    await expect(page.locator("header time")).toContainText("17 de novembro");
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
    await expect(task.getByRole("combobox", { name: "Prioridade", exact: true })).toHaveValue("medium");
    await expect(task.getByRole("checkbox", { name: "Marcar como concluída" })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Configurações", exact: true })).toBeVisible();
    await expect(sidebar(page).getByRole("button", { name: "PT", exact: true })).toHaveCount(0);

    await sidebar(page).getByRole("link", { name: "Configurações", exact: true }).click();
    await page.getByRole("combobox", { name: "Idioma", exact: true }).selectOption("en");
    await page.getByRole("button", { name: "Salvar configurações", exact: true }).click();
    await sidebar(page).getByRole("button", { name: /^All tasks,/ }).click();
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
    await expect(page.getByRole("heading", { name: language.today, level: 1, exact: true })).toBeVisible();
    expect(await rowTitles(openSection(page))).toEqual(["Late", "Due now", "Future picked", "Picked"]);
    await expect(page.getByText(`${language.done} 1`, { exact: true })).toBeVisible();
    await expect(row(page, "Finished")).toBeHidden();

    await sidebar(page).getByRole("button", { name: "#work" }).click();
    expect(await rowTitles(openSection(page))).toEqual(["Later", "Picked"]);
    await expect(todayButton).toHaveText(`${language.today}4`);
    await sidebar(page).getByRole("button", { name: new RegExp(`^${language.all}`) }).click();
    await expect(taskRows(openSection(page))).toHaveCount(6);
  });

  test(`Today empty state in ${language.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Unplanned" }, { title: "Future pick", plannedFor: "2026-11-18" }]);
    await openApp(page);
    await setLanguage(page, language.code);
    await sidebar(page).getByRole("button", { name: new RegExp(`^${language.today}`) }).click();
    await expect(page.getByText(language.empty, { exact: true })).toBeVisible();
    await expect(taskRows(openSection(page))).toHaveCount(0);
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

for (const l of [
  { locale: "en", settings: "Settings", agent: "Assistant", log: "Work log", today: /^Today,/, all: /^All tasks,/,
    projects: "Projects", collapse: "Collapse sidebar", expand: "Expand sidebar", more: "More views", project: /^Project: Release,/ },
  { locale: "pt-BR", settings: "Configurações", agent: "Assistente", log: "Resumo diário", today: /^Hoje,/, all: /^Todas as tarefas,/,
    projects: "Projetos", collapse: "Recolher barra lateral", expand: "Expandir barra lateral", more: "Mais visualizações", project: /^Projeto: Release,/ },
] as const) {
  test(`shares navigation, task views and sidebar preferences across screens in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    const [project] = await seedProjects(request, ["Release"]);
    await seed(request, [{ title: "Planning", projectId: project.id, tags: ["launch"], plannedFor: TODAY }]);
    await page.goto("/");
    const nav = sidebar(page);
    const projects = nav.getByRole("button", { name: l.projects, exact: true });
    await projects.click();
    await expect(projects).toHaveAttribute("aria-expanded", "false");
    await nav.getByRole("button", { name: l.collapse }).click();
    for (const name of [l.settings, l.agent, l.log]) {
      const link = nav.getByRole("link", { name, exact: true });
      await link.click();
      await expect(link).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
      await expect(nav.getByRole("button", { name: l.expand })).toBeVisible();
      await expect(nav.getByRole("button", { name: l.all })).not.toHaveAttribute("aria-current", "page");
    }
    await nav.getByRole("button", { name: l.expand }).click();
    await expect(projects).toHaveAttribute("aria-expanded", "false");
    await projects.click();
    await nav.getByRole("button", { name: l.project }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Release");
    await nav.getByRole("link", { name: l.agent }).click();
    await nav.getByRole("button", { name: /^#launch/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("#launch");
    await page.setViewportSize({ width: 320, height: 760 });
    await nav.getByRole("link", { name: l.settings }).click();
    await expect(nav.getByRole("link", { name: l.settings })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("button", { name: l.more }).click();
    await nav.getByRole("link", { name: l.log }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(l.log);
    await expect(nav.getByRole("button", { name: l.more })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await nav.getByRole("button", { name: l.today }).click();
    await expect(nav.getByRole("button", { name: l.today })).toHaveAttribute("aria-current", "page");
    await expect(row(page, "Planning")).toBeVisible();
  });
}

test("returns from a reloaded Settings page with the board search and task draft", async ({ page, request }) => {
  await seed(request, [{ title: "First match", plannedFor: TODAY }]);
  await page.goto("/");
  await sidebar(page).getByRole("button", { name: /^Today,/ }).click();
  await page.getByRole("searchbox").fill("first");
  const draft = page.getByRole("textbox", { name: /Write a task/ });
  await draft.fill("Finish the remaining work");
  await sidebar(page).getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL("/settings");
  await page.reload();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Today");
  await expect(page.getByRole("searchbox")).toHaveValue("first");
  await expect(draft).toHaveValue("Finish the remaining work");
});

test("refreshes the board after accepting an Assistant proposal", async ({ page, request }) => {
  await saveSettings(request, { aiProvider: "openai", aiModel: "test-agent" });
  await fixture(request, [createTask("Accepted work")]);
  await page.goto("/");
  await sidebar(page).getByRole("link", { name: "Assistant" }).click();
  await page.getByRole("textbox", { name: /What should the assistant organize|What do you need|Describe|Tell the assistant|What would you like/i }).fill("Add the approved report");
  await page.getByRole("button", { name: "Suggest changes", exact: true }).click();
  const card = pending(page, "en").getByRole("article", { name: "Accepted work" });
  await card.getByRole("button", { name: "Accept and save", exact: true }).click();
  await expect(card).toHaveCount(0);
  await sidebar(page).getByRole("button", { name: /^All tasks,/ }).click();
  await expect(row(page, "Accepted work")).toBeVisible({ timeout: 5_000 });
});

test("shows and retries sidebar data errors from Settings", async ({ page }) => {
  await page.route("**/api/tasks", (route) => route.fulfill({ status: 503, json: { error: "generic" } }));
  await page.route("**/api/projects", (route) => route.fulfill({ status: 503, json: { error: "generic" } }));
  await page.goto("/settings");
  const nav = sidebar(page);
  await expect(nav.getByRole("alert")).toHaveCount(2);
  await page.unroute("**/api/tasks");
  await page.unroute("**/api/projects");
  await nav.getByRole("button", { name: /Retry.*tasks/ }).click();
  await nav.getByRole("button", { name: /Retry.*projects/ }).click();
  await expect(nav.getByRole("alert")).toHaveCount(0);
});
