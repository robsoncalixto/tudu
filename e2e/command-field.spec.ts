import { chips, composer, expect, listTasks, openSection, row, saveSettings, seed, seedProjects, taskRows, test, TODAY, TOMORROW, tagChip } from "./support";

const tokens = (page: import("@playwright/test").Page) => page.locator(".command-mirror .command-token").allTextContents();

for (const l of [
  { locale: "en", suggestions: "Suggestions", newTag: "New tag", due: "Due date: Tomorrow · Afternoon", priority: "Priority: High", planned: "Planned day: Today",
    clearPlanned: "Clear planned day", today: "Today", tomorrow: "Tomorrow · Nov 18 @tomorrow", friday: "Friday · Nov 20 @friday", fridayToken: "@friday", high: "High !high",
    project: "Website redesign +website-redesign", notDate: "“@31/02” is not a date, so it stays in the title.",
    noProject: "No project matches “+nope”, so it stays in the title.", error: "Something went wrong. Try again.", count: "2 suggestions. Use the arrow keys to choose." },
  { locale: "pt-BR", suggestions: "Sugestões", newTag: "Nova etiqueta", due: "Prazo: Amanhã · Tarde", priority: "Prioridade: Alta", planned: "Dia planejado: Hoje",
    clearPlanned: "Limpar dia planejado", today: "Hoje", tomorrow: "Amanhã · 18 de nov. @amanhã", friday: "Sexta-feira · 20 de nov. @sexta", fridayToken: "@sexta", high: "Alta !alta",
    project: "Website redesign +website-redesign", notDate: "“@31/02” não é uma data; o texto continua no título.",
    noProject: "Nenhum projeto corresponde a “+nope”; o texto continua no título.", error: "Algo deu errado. Tente novamente.", count: "2 sugestões. Use as setas para escolher." },
] as const) {
  test(`a whole task is typed and saved without a click in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await page.goto("/");
    await expect(page.locator("#open-heading")).toBeVisible();
    await page.keyboard.press("n");
    await expect(composer(page)).toBeFocused();
    await page.keyboard.type("Revisar proposta #trabalho @amanha 14h !alta");
    expect(await tokens(page)).toEqual(["#trabalho", "@amanha 14h", "!alta"]);
    await expect(chips(page).getByRole("button", { name: l.due, exact: true })).toBeVisible();
    await expect(chips(page).getByRole("button", { name: l.priority, exact: true })).toBeVisible();
    await expect(tagChip(page, "trabalho")).toBeVisible();
    // Every token is complete, so Enter saves instead of completing one.
    await expect(composer(page)).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Enter");
    await expect(row(openSection(page), "Revisar proposta")).toBeVisible();
    await expect(composer(page)).toHaveValue("");
    await expect(composer(page)).toBeFocused();
    expect(await listTasks(request)).toMatchObject([
      { title: "Revisar proposta", tags: ["trabalho"], due: TOMORROW, priority: "high", partOfDay: "afternoon", plannedFor: null },
    ]);
  });

  test(`five tasks in a row keep the focus and the Today plan in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await page.goto("/");
    await expect(page.locator("#open-heading")).toBeVisible();
    await page.keyboard.press("g");
    await page.keyboard.press("t");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(l.today);
    await page.keyboard.press("n");
    await expect(chips(page).getByRole("button", { name: l.planned, exact: true })).toBeVisible();
    await expect(chips(page).getByRole("button", { name: l.clearPlanned, exact: true })).toBeVisible();
    for (const title of ["One", "Two", "Three", "Four", "Five"]) {
      await page.keyboard.type(`Task ${title}`);
      await page.keyboard.press("Enter");
      await expect(composer(page)).toHaveValue("");
    }
    await expect(composer(page)).toBeFocused();
    await expect(taskRows(openSection(page))).toHaveCount(5);
    await expect(row(openSection(page), "Task Five")).toBeVisible();
    await expect.poll(async () => (await listTasks(request)).length).toBe(5);
    const saved = await listTasks(request);
    expect(saved.map((task) => task.title).sort()).toEqual(["Task Five", "Task Four", "Task One", "Task Three", "Task Two"]);
    expect(saved.every((task) => task.plannedFor === TODAY)).toBe(true);
  });

  test(`suggestions follow the combobox pattern in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seedProjects(request, ["Website redesign"]);
    await seed(request, [{ title: "Seed", tags: ["work", "home"] }]);
    await page.goto("/");
    const field = composer(page);
    const list = page.getByRole("listbox", { name: l.suggestions });
    const options = list.getByRole("option");
    await field.pressSequentially("Call #");
    await expect(list).toBeVisible();
    await expect(field).toHaveAttribute("aria-expanded", "true");
    await expect(field).toHaveAttribute("aria-autocomplete", "list");
    expect(await field.getAttribute("aria-controls")).toBe(await list.getAttribute("id"));
    await expect(options).toHaveText(["#home", "#work"]);
    await expect(page.getByText(l.count)).toBeAttached();
    await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
    expect(await field.getAttribute("aria-activedescendant")).toBe(await options.nth(0).getAttribute("id"));
    await field.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    expect(await field.getAttribute("aria-activedescendant")).toBe(await options.nth(1).getAttribute("id"));
    await field.press("ArrowDown");
    await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
    await field.press("ArrowUp");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await field.press("Enter");
    await expect(field).toHaveValue("Call #work ");
    await expect(list).toBeHidden();
    await expect(field).toHaveAttribute("aria-expanded", "false");
    expect(await listTasks(request)).toHaveLength(1);

    // A tag that matches nothing saved needs no list: the chip already shows it.
    await field.pressSequentially("#ne");
    await expect(list).toBeHidden();
    await expect(tagChip(page, "ne")).toBeVisible();
    // Part of a saved tag offers both: reuse that one or create the short one.
    await field.press("Backspace");
    await field.press("Backspace");
    await field.pressSequentially("ho");
    await expect(options).toHaveText(["#home", `#ho${l.newTag}`]);
    await field.press("ArrowDown");
    await field.press("Tab");
    await expect(field).toHaveValue("Call #work #ho ");
    await expect(field).toBeFocused();

    await field.pressSequentially("+web");
    await expect(options).toHaveText([l.project.replace(" +", "+")]);
    await field.press("Tab");
    await expect(field).toHaveValue("Call #work #ho +website-redesign ");

    await field.pressSequentially("@");
    await expect(options.nth(1)).toHaveText(l.tomorrow.replace(" @", "@"));
    // "@fri" already means Friday, so a shorter start is typed to see the list.
    await field.pressSequentially(l.fridayToken.slice(1, 3));
    await expect(options.first()).toHaveText(l.friday.replace(" @", "@"));
    await options.first().click();
    await expect(field).toHaveValue(`Call #work #ho +website-redesign ${l.fridayToken} `);
    await expect(field).toBeFocused();

    // Escape closes the list for this token and leaves the text alone.
    await field.pressSequentially("!");
    await expect(options.first()).toHaveText(l.high.replace(" !", "!"));
    await field.press("Escape");
    await expect(list).toBeHidden();
    await expect(field).toHaveValue(`Call #work #ho +website-redesign ${l.fridayToken} !`);
    await field.pressSequentially("1");
    await expect(list).toBeHidden();
    await field.press("Enter");
    await expect(row(openSection(page), "Call")).toBeVisible();
    expect((await listTasks(request)).find((task) => task.title === "Call"))
      .toMatchObject({ tags: ["work", "ho"], due: "2026-11-20", priority: "high" });
  });

  test(`Escape closes the suggestions, then clears, then leaves the field in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seed(request, [{ title: "First task", tags: ["work"] }]);
    await page.goto("/");
    const field = composer(page);
    const list = page.getByRole("listbox", { name: l.suggestions });
    await field.pressSequentially("Draft !alta #");
    await expect(list).toBeVisible();
    await field.press("Escape");
    await expect(list).toBeHidden();
    await expect(field).toHaveValue("Draft !alta #");
    await field.press("Escape");
    await expect(field).toHaveValue("");
    await expect(chips(page).locator("[data-filled]")).toHaveCount(0);
    await expect(field).toBeFocused();
    await field.press("Escape");
    await expect(row(openSection(page), "First task")).toBeFocused();
    expect(await listTasks(request)).toHaveLength(1);
  });

  test(`text that only looks like a token stays in the title in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await page.goto("/");
    const field = composer(page);
    await field.fill(String.raw`Ver C# com nome@email.com sobre bla#bla \#tag a+b`);
    expect(await tokens(page)).toEqual([]);
    await expect(chips(page).locator("[data-filled]")).toHaveCount(0);
    await field.press("Enter");
    await expect(row(openSection(page), "Ver C# com nome@email.com sobre bla#bla #tag a+b")).toBeVisible();
    await field.fill("Pagar @31/02 +nope !alta");
    await expect(page.getByText(l.notDate)).toBeVisible();
    await expect(page.getByText(l.noProject)).toBeVisible();
    expect(await tokens(page)).toEqual(["!alta"]);
    await expect(page.locator(".command-mirror .command-unknown")).toHaveText(["@31/02", "+nope"]);
    await field.press("Enter");
    await expect(row(openSection(page), "Pagar @31/02 +nope")).toBeVisible();
    expect((await listTasks(request)).map(({ title, tags, due, priority, projectId }) => ({ title, tags, due, priority, projectId }))).toEqual([
      { title: "Ver C# com nome@email.com sobre bla#bla #tag a+b", tags: [], due: null, priority: "medium", projectId: null },
      { title: "Pagar @31/02 +nope", tags: [], due: null, priority: "high", projectId: null },
    ]);
  });

  test(`a failed save returns the task to the field above what was typed meanwhile in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await page.goto("/");
    let fail = () => {};
    const held = new Promise<void>((resolve) => { fail = resolve; });
    await page.route("**/api/tasks", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await held;
      await route.fulfill({ status: 500, json: { error: "generic" } });
    });
    const field = composer(page);
    await field.fill("First #a");
    await field.press("Enter");
    // The field is free at once and the task already shows, out of reach until it is saved.
    await expect(field).toHaveValue("");
    await expect(taskRows(openSection(page))).toHaveCount(1);
    await expect(row(openSection(page), "First")).toHaveCount(0);
    await field.pressSequentially("Second");
    fail();
    await expect(page.getByRole("status")).toHaveText(l.error);
    await expect(field).toHaveValue("First #a\nSecond");
    await expect(taskRows(openSection(page))).toHaveCount(0);
    expect(await listTasks(request)).toEqual([]);
    await page.unroute("**/api/tasks");
    await field.press("Enter");
    await expect(row(openSection(page), "First")).toBeVisible();
    await expect(row(openSection(page), "Second")).toBeVisible();
    expect((await listTasks(request)).map((task) => task.title)).toEqual(["First", "Second"]);
  });
}
