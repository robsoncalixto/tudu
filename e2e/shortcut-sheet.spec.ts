import { composer, expect, row, saveSettings, seed, sidebar, test } from "./support";

for (const l of [
  { locale: "en", title: "Keyboard shortcuts", open: "Shortcuts and syntax", single: "Single-key shortcuts", newTask: "Write a new task",
    toggle: "Complete or reopen the task", syntax: "Quick-add syntax", token: "@tomorrow 14h", close: "Close", keys: /^N\s*or\s*Shift\s*A$/, space: /^Space\s*or\s*D$/,
    all: "All tasks", today: "Today", workLog: "Work log", assistant: "Assistant", settings: "Settings", search: "Search this list" },
  { locale: "pt-BR", title: "Atalhos de teclado", open: "Atalhos e sintaxe", single: "Atalhos de uma tecla", newTask: "Escrever uma nova tarefa",
    toggle: "Concluir ou reabrir a tarefa", syntax: "Sintaxe de criação rápida", token: "@amanha 14h", close: "Fechar", keys: /^N\s*ou\s*Shift\s*A$/, space: /^Espaço\s*ou\s*D$/,
    all: "Todas as tarefas", today: "Hoje", workLog: "Resumo diário", assistant: "Assistente", settings: "Configurações", search: "Pesquisar nesta lista" },
] as const) {
  test(`? opens the sheet built from the shortcut registry in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seed(request, [{ title: "First task" }]);
    await page.goto("/");
    const first = row(page, "First task");
    await first.focus();
    await page.keyboard.press("?");
    const sheet = page.getByRole("dialog", { name: l.title, exact: true });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: l.syntax, exact: true })).toBeVisible();
    await expect(sheet.getByText(l.token)).toBeVisible();
    const keysFor = (label: string) => sheet.getByRole("term").filter({ hasText: label }).locator("xpath=following-sibling::dd");
    await expect(keysFor(l.newTask)).toHaveText(l.keys);
    await expect(keysFor(l.toggle)).toHaveText(l.space);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(first).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });

  test(`single-key shortcuts can be switched off and stay off in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seed(request, [{ title: "First task" }]);
    await page.goto("/");
    await sidebar(page).getByRole("button", { name: l.open, exact: true }).click();
    const sheet = page.getByRole("dialog", { name: l.title, exact: true });
    const single = sheet.getByRole("checkbox", { name: l.single, exact: true });
    await expect(single).toBeChecked();
    await expect(sheet.locator(".shortcut-binding .sr-only")).toHaveCount(0);
    await single.uncheck();
    // A key that no longer works is struck out for the eye and said to be off for a reader.
    await expect(sheet.locator(".shortcut-binding[data-off] .sr-only").first()).toHaveText(l.locale === "en" ? "(off)" : "(desligado)");
    await expect(sheet.locator(".shortcut-binding:not([data-off]) .sr-only")).toHaveCount(0);
    await sheet.getByRole("button", { name: l.close, exact: true }).click();
    await expect(sheet).toBeHidden();
    const first = row(page, "First task");
    for (const reloaded of [false, true]) {
      if (reloaded) await page.reload();
      await first.focus();
      for (const key of ["?", "n", "/", "j", "d", "e", "g", "t"]) await page.keyboard.press(key);
      await expect(sheet).toBeHidden();
      await expect(first).toBeFocused();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(l.all);
    }
    // Keys that are not characters keep working on the focused task.
    await page.keyboard.press("Space");
    await expect.poll(async () => (await page.request.get("/api/tasks").then((response) => response.json())).tasks[0].done).toBe(true);
    // The notice names a key for Undo only while that key works.
    await expect(page.getByRole("status").getByRole("button").first().locator("kbd")).toHaveCount(0);
    await expect(page.getByRole("status").getByRole("button").first()).not.toHaveAttribute("aria-keyshortcuts");
    await sidebar(page).getByRole("button", { name: l.open, exact: true }).click();
    await single.check();
    await page.keyboard.press("Escape");
    await page.locator("main").focus();
    await page.keyboard.press("n");
    await expect(composer(page)).toBeFocused();
  });

  test(`shortcuts move between views and never fire while typing in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await page.goto("/");
    const heading = page.getByRole("heading", { level: 1 });
    const search = page.getByRole("searchbox", { name: l.search });
    await expect(heading).toHaveText(l.all);
    await composer(page).pressSequentially("n/?gt jk dez");
    await expect(composer(page)).toHaveValue("n/?gt jk dez");
    await search.pressSequentially("?gw");
    await expect(search).toHaveValue("?gw");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(heading).toHaveText(l.all);
    await search.fill("");
    await composer(page).fill("");
    await page.locator("main").focus();
    await page.keyboard.press("n");
    await expect(composer(page)).toBeFocused();
    await page.locator("main").focus();
    await page.keyboard.press("Shift+A");
    await expect(composer(page)).toBeFocused();
    await page.locator("main").focus();
    await page.keyboard.press("/");
    await expect(search).toBeFocused();
    await page.locator("main").focus();
    await page.keyboard.press("g");
    await page.keyboard.press("t");
    await expect(heading).toHaveText(l.today);
    await page.keyboard.press("g");
    await page.keyboard.press("a");
    await expect(heading).toHaveText(l.all);
    for (const [key, path, title] of [["w", "/work-log", l.workLog], ["i", "/agent", l.assistant], ["s", "/settings", l.settings]] as const) {
      await page.keyboard.press("g");
      await page.keyboard.press(key);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(heading).toHaveText(title);
      await page.locator("main").focus();
    }
    await page.keyboard.press("n");
    await expect(page).toHaveURL(/\/$/);
    await expect(composer(page)).toBeFocused();
    await page.locator("main").focus();
    await page.keyboard.press("g");
    await page.keyboard.press("w");
    await expect(heading).toHaveText(l.workLog);
    await page.locator("main").focus();
    await page.keyboard.press("/");
    await expect(search).toBeFocused();
    await page.locator("main").focus();
    await page.keyboard.press("g");
    await page.keyboard.press("t");
    await expect(heading).toHaveText(l.today);
  });
}
