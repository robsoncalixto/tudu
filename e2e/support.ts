import { expect, test as base, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import type { Step } from "../src/features/tasks/schema";

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
}

export interface StoredTask extends Required<SeedTask> {
  id: string;
  done: boolean;
}

export async function listTasks(request: APIRequestContext): Promise<StoredTask[]> {
  const response = await request.get("/api/tasks");
  return (await response.json()).tasks;
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
  for (const task of await listTasks(request)) {
    await request.delete(`/api/tasks/${task.id}`);
  }
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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("November 17");
  await expect(page.getByText("Loading…")).toHaveCount(0);
}

export const composer = (page: Page) => page.getByRole("textbox", { name: /Write a task/ });
export const sidebar = (page: Page) => page.getByRole("complementary");
export const openSection = (page: Page) => page.locator("section[aria-labelledby='open-heading']");
export const doneSection = (page: Page) => page.locator("details.done");
export const row = (scope: Page | Locator, title: string) =>
  scope.getByRole("listitem").filter({ hasText: title });
export const rowTitles = (scope: Locator) => scope.locator(".task-title").allTextContents();

export async function addTask(page: Page, title: string) {
  await composer(page).fill(title);
  await composer(page).press("Enter");
  await expect(row(openSection(page), title)).toBeVisible();
}
