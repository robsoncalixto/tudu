import type { APIRequestContext, Page } from "@playwright/test";
import type { Task } from "../src/features/tasks/schema";
import { expect, listTasks, saveSettings, seed, seedProjects, sidebar, test, TODAY, YESTERDAY } from "./support";

const languages = [
  { locale: "en", title: "Work log", day: "Completed on", group: "Group by", noProject: "No project", noTags: "No tags", count: "2 tasks completed", text: "Copy plain text", markdown: "Copy Markdown", copied: "Work log copied.", ai: "Summarize with AI", summary: "AI summary", ready: "AI summary ready. Review it before sharing.", paragraph: "Shipped the report and reviewed the release.", busy: "The AI is busy right now. Try again in a moment.", empty: "No tasks completed on this day.", refresh: "Refresh", loadFailed: "Couldn't load the work log. Try Refresh.", manual: "Select and copy this work log", copyFailed: "Copying was blocked. Select and copy the work log below.", back: "Back to tasks" },
  { locale: "pt-BR", title: "Resumo diário", day: "Concluídas em", group: "Agrupar por", noProject: "Sem projeto", noTags: "Sem etiquetas", count: "2 tarefas concluídas", text: "Copiar texto simples", markdown: "Copiar Markdown", copied: "Resumo diário copiado.", ai: "Resumir com IA", summary: "Resumo com IA", ready: "Resumo com IA pronto. Revise antes de compartilhar.", paragraph: "Enviei o relatório e revisei a versão.", busy: "A IA está ocupada agora. Tente de novo em instantes.", empty: "Nenhuma tarefa concluída neste dia.", refresh: "Atualizar", loadFailed: "Não foi possível carregar o resumo diário. Tente Atualizar.", manual: "Selecione e copie este resumo diário", copyFailed: "A cópia foi bloqueada. Selecione e copie o resumo diário abaixo.", back: "Voltar às tarefas" },
] as const;

async function prepare(page: Page, request: APIRequestContext, locale: "en" | "pt-BR") {
  const [project] = await seedProjects(request, ["Acme"]);
  const created = await seed(request, [
    { title: "Ship *report*", projectId: project.id, due: "2026-12-01", tags: ["client", "work"] },
    { title: "Review release", due: YESTERDAY }, { title: "Yesterday's work", due: TODAY }, { title: "Still open", due: TODAY },
  ]);
  for (const task of created.slice(0, 3)) await request.patch(`/api/tasks/${task.id}`, { data: { done: true } });
  const saved = (await (await request.get("/api/tasks")).json()).tasks as Task[];
  // Completion timestamps are fixed independently of the server's real clock.
  const times = ["2026-11-17T03:00:00.000Z", "2026-11-18T02:59:59.999Z", "2026-11-17T02:59:59.999Z"];
  await page.route("**/api/tasks", (route) => route.fulfill({ json: { tasks: saved.map((task, index) => ({ ...task, completedAt: times[index] ?? null })) } }));
  await saveSettings(request, { locale });
  return saved;
}

for (const l of languages) {
  test(`selects the completed day and groups by project or tag in ${l.locale}`, async ({ page, request }) => {
    const saved = await prepare(page, request, l.locale);
    await page.goto("/");
    await sidebar(page).getByRole("link", { name: l.title, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(l.title);
    await expect(page.getByLabel(l.day, { exact: true })).toHaveValue(TODAY);
    await expect(page.getByRole("heading", { name: l.count, exact: true })).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveText(["Ship *report*", "Review release"]);
    await expect(page.getByRole("heading", { name: "Acme", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: l.noProject, exact: true })).toBeVisible();
    await expect(page.getByText(/America\/Sao_Paulo/)).toBeVisible();
    await page.getByRole("combobox", { name: l.group, exact: true }).selectOption("tag");
    await expect(page.getByRole("listitem")).toHaveText(["Ship *report*", "Ship *report*", "Review release"]);
    await expect(page.getByRole("heading", { name: l.noTags, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: l.count, exact: true })).toBeVisible();
    await page.getByLabel(l.day, { exact: true }).fill(YESTERDAY);
    await expect(page.getByRole("listitem")).toHaveText(["Yesterday's work"]);
    await page.getByLabel(l.day, { exact: true }).fill("2026-11-15");
    await expect(page.getByText(l.empty, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: l.text, exact: true })).toBeDisabled();
    expect(await listTasks(request)).toEqual(saved);
    await page.getByRole("link", { name: l.back, exact: true }).click();
    await expect(sidebar(page).getByRole("link", { name: l.title, exact: true })).toBeVisible();
  });

  test(`copies plain text and safe Markdown without changing tasks in ${l.locale}`, async ({ page, request, context }) => {
    const saved = await prepare(page, request, l.locale);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/work-log");
    await page.getByRole("button", { name: l.text, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(l.copied);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${l.title} — ${TODAY}\n\nAcme\n- Ship *report*\n\n${l.noProject}\n- Review release`);
    await page.getByRole("button", { name: l.markdown, exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`# ${l.title} — ${TODAY}\n\n## Acme\n- Ship \\*report\\*\n\n## ${l.noProject}\n- Review release`);
    expect(await listTasks(request)).toEqual(saved);
  });

  test(`load and clipboard failures recover in ${l.locale}`, async ({ page, request }) => {
    const saved = await prepare(page, request, l.locale);
    await page.route("**/api/tasks", (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    await page.goto("/work-log");
    await expect(page.getByRole("status")).toHaveText(l.loadFailed);
    await expect(page.getByText(l.empty, { exact: true })).toHaveCount(0);
    await page.unroute("**/api/tasks");
    await page.route("**/api/tasks", (route) => route.fulfill({ json: { tasks: saved.map((task) => task.done ? { ...task, completedAt: "2026-11-17T15:00:00Z" } : task) } }));
    await page.getByRole("button", { name: l.refresh, exact: true }).click();
    await expect(page.getByRole("listitem")).toHaveCount(3);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("blocked")) } });
      document.execCommand = () => false;
    });
    await page.getByRole("button", { name: l.text, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(l.copyFailed);
    const manual = page.getByRole("textbox", { name: l.manual, exact: true });
    await expect(manual).toHaveAttribute("readonly", "");
    await expect(manual).toContainText("Ship *report*");
    await page.getByRole("combobox", { name: l.group, exact: true }).selectOption("tag");
    await expect(manual).toHaveCount(0);
    await expect(page.getByRole("status")).toBeEmpty();
    expect(await listTasks(request)).toEqual(saved);
  });

  test(`optional AI summary retries, copies and clears with the selected day in ${l.locale}`, async ({ page, request, context }) => {
    const saved = await prepare(page, request, l.locale);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.route("**/api/ai/capture", (route) => route.fulfill({ json: { enabled: true } }));
    let attempts = 0;
    await page.route("**/api/work-log/summary", (route) => {
      expect(route.request().postDataJSON()).toEqual({ day: TODAY, timeZone: "America/Sao_Paulo" });
      attempts++;
      return route.fulfill(attempts === 1 ? { status: 429, json: { error: "ai_busy" } } : { json: { summary: l.paragraph } });
    });
    await page.goto("/work-log");
    await page.getByRole("button", { name: l.ai, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(l.busy);
    await page.getByRole("button", { name: l.ai, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(l.ready);
    await expect(page.getByRole("heading", { name: l.summary, exact: true })).toBeVisible();
    await expect(page.getByText(l.paragraph, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: l.text, exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(l.paragraph);
    await page.getByLabel(l.day, { exact: true }).fill(YESTERDAY);
    await expect(page.getByText(l.paragraph, { exact: true })).toHaveCount(0);
    expect(await listTasks(request)).toEqual(saved);
  });

  test(`phone layout and keyboard focus with AI disabled in ${l.locale}`, async ({ page, request }) => {
    await prepare(page, request, l.locale);
    await page.setViewportSize({ width: 320, height: 812 });
    await page.goto("/work-log");
    await expect(page.getByRole("heading", { name: l.count, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: l.ai, exact: true })).toBeDisabled();
    for (const control of [
      page.getByRole("link", { name: l.back, exact: true }),
      page.getByLabel(l.day, { exact: true }),
      page.getByRole("combobox", { name: l.group, exact: true }),
      page.getByRole("button", { name: l.refresh, exact: true }),
    ]) {
      expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole("combobox", { name: l.group, exact: true }).focus();
    expect(await page.getByRole("combobox", { name: l.group, exact: true }).evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

test("HTTP clipboard fallback copies text and restores focus", async ({ page, request, context }) => {
  await prepare(page, request, "en");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/work-log");
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }));
  const copy = page.getByRole("button", { name: "Copy plain text", exact: true });
  await copy.click();
  await expect(page.getByRole("status")).toHaveText("Work log copied.");
  await expect(copy).toBeFocused();
  const reader = await context.newPage();
  await reader.goto("/work-log");
  expect(await reader.evaluate(() => navigator.clipboard.readText())).toContain("Ship *report*");
  await reader.close();
});

test("a late AI response cannot attach a summary to another day", async ({ page, request }) => {
  await prepare(page, request, "en");
  await page.route("**/api/ai/capture", (route) => route.fulfill({ json: { enabled: true } }));
  let release = () => {};
  const wait = new Promise<void>((resolve) => { release = resolve; });
  let requested = false;
  await page.route("**/api/work-log/summary", async (route) => { requested = true; await wait; await route.fulfill({ json: { summary: "Stale summary" } }); });
  await page.goto("/work-log");
  const response = page.waitForResponse("**/api/work-log/summary");
  await page.getByRole("button", { name: "Summarize with AI", exact: true }).click();
  await expect.poll(() => requested).toBe(true);
  await page.getByLabel("Completed on", { exact: true }).fill(YESTERDAY);
  release(); await response;
  await expect(page.getByText("Stale summary", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Summarize with AI", exact: true })).toBeEnabled();
});

test("work-log summary API validates dates and refuses model use without a key", async ({ page, request }) => {
  await page.goto("/work-log");
  for (const data of [{ day: "2026-02-30", timeZone: "UTC" }, { day: TODAY, timeZone: "unknown" }, { day: TODAY, timeZone: "UTC", tasks: [] }]) {
    const response = await request.post("/api/work-log/summary", { data });
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_work_log" });
  }
  expect((await request.post("/api/work-log/summary", { data: { day: TODAY, timeZone: "UTC" } })).status()).toBe(503);
});
