import { DEFAULT_SETTINGS } from "../src/features/settings/schema";
import { expect, listSettings, listTasks, openApp, row, saveSettings, seed, sidebar, test, TODAY } from "./support";

const languages = [
  { locale: "en", settings: "Settings", priority: "Default priority", start: "Start view", format: "Date format", save: "Save settings", saved: "Settings saved.", back: "Back to tasks", today: "Today", rowPriority: "Priority", add: "Add", error: "Something went wrong. Try again.", ai: "AI", system: "System", light: "Light", dark: "Dark" },
  { locale: "pt-BR", settings: "Configurações", priority: "Prioridade padrão", start: "Visualização inicial", format: "Formato de data", save: "Salvar configurações", saved: "Configurações salvas.", back: "Voltar às tarefas", today: "Hoje", rowPriority: "Prioridade", add: "Adicionar", error: "Algo deu errado. Tente novamente.", ai: "IA", system: "Sistema", light: "Claro", dark: "Escuro" },
] as const;

for (const language of languages) {
  test(`previews, saves and follows system appearance in ${language.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: language.locale });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/settings");
    const canvas = page.locator("body");
    const save = page.getByRole("button", { name: language.save, exact: true });
    await expect(page.getByRole("radio", { name: language.system, exact: true })).toBeChecked();
    const light = await canvas.evaluate((body) => getComputedStyle(body).backgroundColor);
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(canvas).not.toHaveCSS("background-color", light);
    const dark = await canvas.evaluate((body) => getComputedStyle(body).backgroundColor);
    await page.getByRole("radio", { name: language.light, exact: true }).check();
    await expect(canvas).toHaveCSS("background-color", light);
    expect((await listSettings(request)).theme).toBe("system");
    await page.reload();
    await expect(canvas).toHaveCSS("background-color", dark);
    await page.getByRole("radio", { name: language.dark, exact: true }).check();
    await save.click();
    await expect(page.getByRole("status")).toHaveText(language.saved);
    expect((await listSettings(request)).theme).toBe("dark");
    await page.emulateMedia({ colorScheme: "light" });
    await page.getByRole("link", { name: language.back, exact: true }).click();
    await expect(canvas).toHaveCSS("background-color", dark);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const workLog = await request.get("/work-log");
    expect(await workLog.text()).toMatch(/<html\b[^>]*\bdata-theme="dark"/);
  });

  test(`selects providers and models, validates drafts and recovers failed saves in ${language.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: language.locale });
    await page.goto("/settings");
    const provider = page.getByRole("combobox", { name: language.locale === "en" ? "AI provider" : "Provedor de IA", exact: true });
    const model = page.getByRole("textbox", { name: language.locale === "en" ? "AI model" : "Modelo de IA", exact: true });
    const save = page.getByRole("button", { name: language.save, exact: true });
    await provider.selectOption("openai"); await model.fill("custom-model");
    expect((await listSettings(request)).aiProvider).toBe("anthropic");
    await save.click(); await expect(page.getByRole("status")).toHaveText(language.saved);
    expect(await listSettings(request)).toMatchObject({ aiProvider: "openai", aiModel: "custom-model" });
    await page.reload(); await expect(provider).toHaveValue("openai"); await expect(model).toHaveValue("custom-model");
    await provider.selectOption("openrouter"); await expect(model).toHaveValue("");
    await expect(model).toHaveAttribute("placeholder", "anthropic/claude-opus-5.5");
    await model.fill("bad model"); await save.click();
    await expect(page.getByRole("status")).toHaveText(language.locale === "en"
      ? "Those settings are invalid. Check your choices and try again."
      : "Essas configurações são inválidas. Confira suas escolhas e tente novamente.");
    expect((await listSettings(request)).aiProvider).toBe("openai");
    await model.fill("openai/gpt-6.2-sol");
    await page.route("**/api/settings", (route) => route.request().method() === "PATCH"
      ? route.fulfill({ status: 500, json: { error: "failed" } }) : route.fallback());
    await save.click(); await expect(page.getByRole("status")).toHaveText(language.error);
    await expect(model).toHaveValue("openai/gpt-6.2-sol");
    await page.unroute("**/api/settings"); await save.click();
    await expect(page.getByRole("status")).toHaveText(language.saved);
    const stored = await listSettings(request);
    expect(stored).toMatchObject({ aiProvider: "openrouter", aiModel: "openai/gpt-6.2-sol" });
    expect(JSON.stringify(stored)).not.toMatch(/apiKey|API_KEY|authToken/);
    expect(await (await request.get("/api/ai/capture")).json()).toEqual({ enabled: false });
    await page.getByRole("link", { name: language.back, exact: true }).click();
    await page.getByRole("textbox", { name: /Write a task|Escreva uma tarefa/ }).fill("Works without AI");
    await page.getByRole("button", { name: language.add, exact: true }).click();
    expect((await listTasks(request)).map((task) => task.title)).toEqual(["Works without AI"]);
    await expect(page.getByRole("button", { name: language.locale === "en" ? "Create with AI" : "Criar com IA", exact: true })).toBeDisabled();
  });
  test(`saves and applies every preference in ${language.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: language.locale });
    await seed(request, [{ title: "Due task", due: TODAY }]);
    await page.goto("/");
    await sidebar(page).getByRole("link", { name: language.settings, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(language.settings);
    await expect(page.getByRole("combobox", { name: language.priority, exact: true })).toHaveValue("medium");
    await page.getByRole("combobox", { name: language.priority, exact: true }).selectOption("high");
    await page.getByRole("combobox", { name: language.start, exact: true }).selectOption("today");
    await page.getByRole("combobox", { name: language.format, exact: true }).selectOption("iso");
    await page.getByRole("button", { name: language.save, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(language.saved);
    expect(await listSettings(request)).toEqual({ automaticReview: { enabled: false, enabledAt: null, time: "09:00", timeZone: "UTC" }, locale: language.locale, theme: "system", defaultPriority: "high", startView: "today", dateFormat: "iso", aiProvider: "anthropic", aiModel: "" });
    await expect(page.getByRole("heading", { name: language.ai, exact: true })).toBeVisible();
    await page.getByRole("link", { name: language.back, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(language.today);
    await expect(page.locator("header time")).toContainText(TODAY);
    await expect(sidebar(page).getByRole("button", { name: new RegExp(`^${language.today}`) })).toHaveAttribute("aria-current", "page");
    await expect(row(page, "Due task").getByText(TODAY, { exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: /Write a task|Escreva uma tarefa/ }).fill("Uses preferred priority");
    await page.getByRole("button", { name: language.add, exact: true }).click();
    await expect(row(page, "Uses preferred priority").getByRole("combobox", { name: language.rowPriority, exact: true })).toHaveValue("high");
    await expect.poll(async () => (await listTasks(request)).find((task) => task.title === "Uses preferred priority")?.priority).toBe("high");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(language.today);
    await expect(page.locator("header time")).toContainText(TODAY);
    await expect(sidebar(page).getByRole("button", { name: new RegExp(`^${language.today}`) })).toHaveAttribute("aria-current", "page");
  });

  test(`failed preference saves preserve the draft and allow retry in ${language.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: language.locale });
    await page.goto("/settings");
    await page.getByRole("combobox", { name: language.priority, exact: true }).selectOption("high");
    await page.route("**/api/settings", (route) => route.request().method() === "PATCH"
      ? route.fulfill({ status: 500, json: { error: "failed" } }) : route.fallback());
    await page.getByRole("button", { name: language.save, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(language.error);
    await expect(page.getByRole("combobox", { name: language.priority, exact: true })).toHaveValue("high");
    await expect(page.getByRole("button", { name: language.save, exact: true })).toBeEnabled();
    expect((await listSettings(request)).defaultPriority).toBe("medium");
    await page.unroute("**/api/settings");
    await page.getByRole("button", { name: language.save, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(language.saved);
    expect((await listSettings(request)).defaultPriority).toBe("high");
  });

  test(`settings fit a phone and retain visible keyboard focus in ${language.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: language.locale });
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/settings");
    const back = page.getByRole("link", { name: language.back, exact: true });
    await page.keyboard.press("Tab");
    await expect(back).toBeFocused();
    expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    for (const control of await page.getByRole("combobox").all()) {
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const model = page.getByRole("textbox", { name: language.locale === "en" ? "AI model" : "Modelo de IA" });
    await model.scrollIntoViewIfNeeded();
    expect((await model.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(back).toBeInViewport();
    const priority = page.getByRole("combobox", { name: language.priority, exact: true });
    await priority.focus();
    await expect(priority).toBeFocused();
    expect(await priority.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
    await expect(page.getByRole("button", { name: language.save, exact: true })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await back.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(language.locale === "en" ? "All tasks" : "Todas as tarefas");
  });

  test(`returns to the assistant after opening its settings in ${language.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: language.locale });
    await page.goto("/agent");
    await page.getByRole("link", { name: language.settings, exact: true }).click();
    const back = page.getByRole("link", { name: language.locale === "en" ? "Back to assistant" : "Voltar ao assistente", exact: true });
    await back.focus();
    await back.press("Enter");
    await expect(page).toHaveURL(/\/agent$/);
  });

  test(`chooses a preference from the open picker with a pointer and keyboard in ${language.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: language.locale });
    await page.goto("/settings");
    const priority = page.getByRole("combobox", { name: language.priority, exact: true });
    await priority.click();
    const high = page.getByRole("option", { name: language.locale === "en" ? "High" : "Alta", exact: true });
    await expect(high).toBeVisible();
    const bounds = (await high.boundingBox())!;
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    await high.click({ position: { x: bounds.width - 10, y: bounds.height - 6 } });
    await expect(priority).toHaveValue("high");
    await priority.press("Space");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Escape");
    await expect(high).toBeHidden();
    await expect(priority).toBeFocused();
    await expect(priority).toHaveValue("high");
    await priority.press("Space");
    await page.keyboard.press("Home");
    await page.keyboard.press("Enter");
    await expect(priority).toHaveValue("low");
    expect((await listSettings(request)).defaultPriority).toBe("medium");
    await page.getByRole("button", { name: language.save, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(language.saved);
    expect((await listSettings(request)).defaultPriority).toBe("low");
  });
}

test("saved language is shared with a fresh browser session", async ({ page, browser }) => {
  await openApp(page);
  await sidebar(page).getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("combobox", { name: "Language", exact: true }).selectOption("pt-BR");
  await page.getByRole("button", { name: "Save settings", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Configurações salvas.");
  const context = await browser.newContext({ baseURL: new URL(page.url()).origin, timezoneId: "America/Sao_Paulo" });
  try {
    const other = await context.newPage();
    await other.clock.setFixedTime(new Date(`${TODAY}T12:00:00-03:00`));
    await other.goto("/");
    await expect(other.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(other.getByRole("heading", { level: 1 })).toHaveText("Todas as tarefas");
    await expect(other.locator("header time")).toContainText("17 de novembro");
    await expect(sidebar(other).getByRole("link", { name: "Configurações", exact: true })).toBeVisible();
    expect(await other.evaluate(() => localStorage.getItem("tudu.locale"))).toBeNull();
  } finally { await context.close(); }
});

test("settings API rejects invalid preferences and preserves partial updates", async ({ page, request }) => {
  await openApp(page);
  await saveSettings(request, { defaultPriority: "high", startView: "today" });
  for (const data of [{ startView: "unknown" }, { locale: "fr" }, { theme: "unknown" }, { apiKey: "test-value" }]) {
    const response = await request.patch("/api/settings", { data });
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_settings" });
  }
  await saveSettings(request, { dateFormat: "iso" });
  expect(await listSettings(request)).toEqual({ ...DEFAULT_SETTINGS, defaultPriority: "high", startView: "today", dateFormat: "iso" });
  const response = await request.post("/api/tasks", { data: [{ title: "Default" }, { title: "Explicit", priority: "low" }] });
  expect(response.status()).toBe(201);
  expect((await listTasks(request)).map((task) => task.priority)).toEqual(["high", "low"]);
});

test("saving one preference preserves changes made in another session", async ({ page, request }) => {
  await page.goto("/settings");
  await expect(page.getByRole("combobox", { name: "Date format", exact: true })).toHaveValue("locale");
  await saveSettings(request, { dateFormat: "iso" });
  await page.getByRole("combobox", { name: "Default priority", exact: true }).selectOption("high");
  await page.getByRole("button", { name: "Save settings", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Settings saved.");
  expect(await listSettings(request)).toEqual({ ...DEFAULT_SETTINGS, defaultPriority: "high", dateFormat: "iso" });
  await expect(page.getByRole("combobox", { name: "Date format", exact: true })).toHaveValue("iso");
});

test("provider/model saves stay paired when another session changes the model", async ({ page, request }) => {
  await page.goto("/settings");
  await expect(page.getByRole("textbox", { name: "AI model", exact: true })).toHaveValue("");
  await saveSettings(request, { aiModel: "previous-provider-model" });
  await page.getByRole("combobox", { name: "AI provider", exact: true }).selectOption("openai");
  await page.getByRole("button", { name: "Save settings", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Settings saved.");
  expect(await listSettings(request)).toMatchObject({ aiProvider: "openai", aiModel: "" });
});
