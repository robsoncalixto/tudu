import { expect, test as base, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import type { Step } from "../src/features/tasks/schema";
import type { RepeatRule } from "../src/features/recurrence/schema";
import type { Project } from "../src/features/projects/schema";
import { DEFAULT_SETTINGS, type Settings, type SettingsPatch } from "../src/features/settings/schema";
import { unlink } from "node:fs/promises";
import path from "node:path";

/** The day every test runs on: Tuesday, November 17, 2026 (local time). */
export const TODAY = "2026-11-17";
export const YESTERDAY = "2026-11-16";
export const TOMORROW = "2026-11-18";

export interface SeedTask {
  title: string;
  notes?: string;
  priority?: "low" | "medium" | "high";
  due?: string | null;
  tags?: string[];
  plannedFor?: string | null;
  steps?: Step[];
  estimateMinutes?: number | null;
  links?: string[];
  projectId?: string | null;
  repeat?: RepeatRule | null;
}

export interface StoredTask extends Required<SeedTask> {
  id: string;
  done: boolean;
  nextOccurrenceId: string | null;
}

export async function listTasks(request: APIRequestContext): Promise<StoredTask[]> {
  const response = await request.get("/api/tasks");
  return (await response.json()).tasks;
}

export async function listProjects(request: APIRequestContext): Promise<Project[]> {
  const response = await request.get("/api/projects");
  expect(response.ok()).toBe(true);
  return (await response.json()).projects;
}

export async function seedProjects(request: APIRequestContext, names: string[]): Promise<Project[]> {
  return Promise.all(names.map(async (name) => {
    const response = await request.post("/api/projects", { data: { name } });
    expect(response.status()).toBe(201);
    return (await response.json()).project as Project;
  }));
}

export async function seed(request: APIRequestContext, tasks: SeedTask[]): Promise<StoredTask[]> {
  const response = await request.post("/api/tasks", {
    data: tasks.map(({ plannedFor: _plannedFor, ...input }) => input),
  });
  expect(response.status()).toBe(201);
  const created: StoredTask[] = (await response.json()).tasks;
  return Promise.all(created.map(async (task, index) => {
    const plannedFor = tasks[index].plannedFor;
    if (plannedFor === undefined) return task;
    const patched = await request.patch(`/api/tasks/${task.id}`, { data: { plannedFor } });
    expect(patched.ok()).toBe(true);
    return (await patched.json()).task as StoredTask;
  }));
}

async function reset(request: APIRequestContext) {
  const dataDir = process.env.TUDU_E2E_DATA_DIR;
  if (!dataDir || !path.basename(dataDir).startsWith("tudu-e2e-")) throw new Error("Proposal reset requires an isolated tudu-e2e- directory");
  await unlink(path.join(dataDir, "proposals.json")).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
  await saveSettings(request, DEFAULT_SETTINGS);
  for (const task of await listTasks(request)) {
    await request.delete(`/api/tasks/${task.id}`);
  }
  for (const project of await listProjects(request)) {
    const response = await request.delete(`/api/projects/${project.id}`);
    expect(response.status()).toBe(204);
  }
}

export async function saveSettings(request: APIRequestContext, patch: SettingsPatch): Promise<Settings> {
  const response = await request.patch("/api/settings", { data: patch });
  expect(response.ok()).toBe(true);
  return (await response.json()).settings;
}

export async function listSettings(request: APIRequestContext): Promise<Settings> {
  const response = await request.get("/api/settings");
  expect(response.ok()).toBe(true);
  return (await response.json()).settings;
}

export async function setLanguage(page: Page, code: string) {
  const locale = code === "PT" || code === "pt-BR" ? "pt-BR" : "en";
  await saveSettings(page.request, { locale });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("#open-heading")).toBeVisible();
}

/** Each test starts with no tasks and a fixed clock. */
export const test = base.extend({
  page: async ({ page, request }, use) => {
    await reset(request);
    await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00`));
    await use(page);
  },
});

export { expect };

export async function openApp(page: Page) {
  await page.goto("/");
  await expect(page.locator("header time")).toContainText("November 17");
  await expect(page.getByText("Loading…")).toHaveCount(0);
}

export const composer = (page: Page) => page.getByRole("textbox", { name: /Write a task|Escreva uma tarefa/ });
export const sidebar = (page: Page) => page.getByRole("complementary").filter({
  has: page.getByRole("navigation", { name: /^(Task views|Visualizações de tarefas)$/ }),
});
export const taskPanel = (page: Page) => page.getByRole("complementary", { name: /^(Task details|Detalhes da tarefa)$/ });
export const closeTaskPanel = (page: Page) => taskPanel(page).getByRole("button", { name: /^(Close task details|Fechar detalhes da tarefa)$/ });
export const openSection = (page: Page) => page.locator("section[aria-labelledby='open-heading']");
export const doneSection = (page: Page) => page.locator("details.done");
export const row = (scope: Page | Locator, title: string) =>
  scope.getByRole("listitem", { name: title, exact: true });
export const taskRows = (scope: Locator) => scope.locator(".tasks > li");
export const taskDetails = (task: Locator) => task.getByRole("button", { name: /^(Task details|Detalhes da tarefa)$/ });
export const rowTitles = (scope: Locator) => scope.locator(".task-title").allTextContents();

export async function addTask(page: Page, title: string) {
  await composer(page).fill(title);
  await composer(page).press("Enter");
  await expect(row(openSection(page), title)).toBeVisible();
}
