import { doneSection, expect, listTasks, openSection, row, saveSettings, seed, sidebar, test } from "./support";

for (const l of [
  { locale: "en", done: "Mark as done", open: "Mark as open", completed: "Task completed.", reopened: "Task reopened.", undo: "Undo", dismiss: "Dismiss",
    doneHeading: "Done", next: "Next task scheduled for Tomorrow.", error: "Something went wrong. Try again." },
  { locale: "pt-BR", done: "Marcar como concluída", open: "Marcar como aberta", completed: "Tarefa concluída.", reopened: "Tarefa reaberta.", undo: "Desfazer", dismiss: "Dispensar",
    doneHeading: "Concluídas", next: "Próxima tarefa programada para Amanhã.", error: "Algo deu errado. Tente novamente." },
] as const) {
  test(`completing and reopening a task can be undone from the notice in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seed(request, [{ title: "Write report" }, { title: "Other task" }]);
    await page.goto("/");
    const status = page.getByRole("status");
    const task = row(openSection(page), "Write report");
    const listTop = (await openSection(page).boundingBox())!.y;
    await task.getByRole("checkbox", { name: l.done, exact: true }).click();
    await expect(task).toHaveCount(0);
    await expect(status).toHaveText(`${l.completed}${l.undo}`);
    // The notice floats, so the list stays where it was.
    expect((await openSection(page).boundingBox())!.y).toBe(listTop);
    await expect.poll(async () => (await listTasks(request))[0].done).toBe(true);
    await status.getByRole("button", { name: l.undo, exact: true }).click();
    await expect(task).toBeFocused();
    await expect(status).toHaveText("");
    await expect.poll(async () => (await listTasks(request))[0].done).toBe(false);

    await task.getByRole("checkbox", { name: l.done, exact: true }).click();
    await doneSection(page).getByText(l.doneHeading).click();
    await row(doneSection(page), "Write report").getByRole("checkbox", { name: l.open, exact: true }).click();
    await expect(status).toHaveText(`${l.reopened}${l.undo}`);
    await page.locator("main").focus();
    await page.keyboard.press("z");
    await expect(row(openSection(page), "Write report")).toHaveCount(0);
    await expect(status).toHaveText("");
    await expect.poll(async () => (await listTasks(request))[0].done).toBe(true);
  });

  test(`a repeating task keeps Undo beside the next date and a failure replaces the notice in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    const [repeating] = await seed(request, [{ title: "Daily report", due: "2026-11-17", repeat: { frequency: "daily" } }, { title: "Fragile" }]);
    await page.goto("/");
    const status = page.getByRole("status");
    await row(openSection(page), "Daily report").filter({ hasText: /./ }).first().getByRole("checkbox", { name: l.done, exact: true }).click();
    await expect(status).toHaveText(`${l.completed} ${l.next}${l.undo}`);
    await status.getByRole("button", { name: l.undo, exact: true }).click();
    await expect.poll(async () => (await listTasks(request)).find((task) => task.id === repeating.id)?.done).toBe(false);

    await page.route("**/api/tasks/*", (route) => route.request().method() === "PATCH"
      ? route.fulfill({ status: 500, json: { error: "generic" } }) : route.fallback());
    await row(openSection(page), "Fragile").getByRole("checkbox", { name: l.done, exact: true }).click();
    await expect(status).toHaveText(l.error);
    await expect(status.getByRole("button", { name: l.undo, exact: true })).toHaveCount(0);
    await expect(row(openSection(page), "Fragile")).toBeVisible();
    await status.getByRole("button", { name: l.dismiss, exact: true }).click();
    await expect(status).toHaveText("");
  });
}

test("a notice leaves on its own, waits while the pointer is on it, and then lets a deletion through", async ({ page, request }) => {
  await seed(request, [{ title: "Short lived" }, { title: "Stays" }]);
  await page.goto("/");
  const status = page.getByRole("status");
  const task = row(openSection(page), "Short lived");
  await task.focus();
  await page.keyboard.press("Delete");
  await expect(status).toHaveText("Task deleted.Undo");
  await status.hover();
  await page.waitForTimeout(6500);
  await expect(status).toHaveText("Task deleted.Undo");
  expect(await listTasks(request)).toHaveLength(2);
  await page.getByRole("heading", { level: 1 }).hover();
  await expect(status).toHaveText("", { timeout: 9000 });
  await expect.poll(async () => (await listTasks(request)).map((item) => item.title)).toEqual(["Stays"]);
  // An error does not leave on its own.
  await page.route("**/api/tasks/*", (route) => route.fulfill({ status: 500, json: { error: "generic" } }));
  await row(openSection(page), "Stays").getByRole("checkbox").click();
  await expect(status).toHaveText("Something went wrong. Try again.");
  await page.waitForTimeout(6500);
  await expect(status).toHaveText("Something went wrong. Try again.");
});

test("the notice fits a phone and its controls are easy to touch", async ({ page, request }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await seed(request, [{ title: "A task with a title long enough to wrap on a narrow phone screen" }]);
  await page.goto("/");
  await page.getByRole("checkbox", { name: "Mark as done" }).click();
  const status = page.getByRole("status");
  await expect(status).toContainText("Task completed.");
  for (const name of ["Undo", "Dismiss"]) {
    const box = await status.getByRole("button", { name, exact: true }).boundingBox();
    expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(44);
  }
  const bounds = await status.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await sidebar(page).getByRole("button", { name: /^Today,/ }).click();
  await expect(status).toHaveText("");
});
