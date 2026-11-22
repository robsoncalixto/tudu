import { doneSection, expect, listTasks, openSection, row, saveSettings, seed, sidebar, test } from "./support";

for (const l of [
  { locale: "en", done: "Mark as done", open: "Mark as open", undo: "Undo", dismiss: "Dismiss", retry: "Retry", setDate: "Due date",
    completed: (title: string) => `Completed “${title}”.`, reopened: (title: string) => `Reopened “${title}”.`,
    deleted: (title: string) => `Deleted “${title}”.`, restored: (title: string) => `Restored “${title}”.`,
    due: (title: string, date: string) => `Due date of “${title}”: ${date}.`, later: "Nov 27", friday: "Nov 20",
    doneHeading: "Done", next: "Next task scheduled for Tomorrow.", error: "Something went wrong. Try again." },
  { locale: "pt-BR", done: "Marcar como concluída", open: "Marcar como aberta", undo: "Desfazer", dismiss: "Dispensar", retry: "Tentar novamente", setDate: "Prazo",
    completed: (title: string) => `“${title}” concluída.`, reopened: (title: string) => `“${title}” reaberta.`,
    deleted: (title: string) => `“${title}” excluída.`, restored: (title: string) => `“${title}” restaurada.`,
    due: (title: string, date: string) => `Prazo de “${title}”: ${date}.`, later: "27 de nov", friday: "20 de nov",
    doneHeading: "Concluídas", next: "Próxima tarefa programada para Amanhã.", error: "Algo deu errado. Tente novamente." },
] as const) {
  test(`undoing a reopening preserves its completion timestamp in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    const [task] = await seed(request, [{ title: "Finished report" }]);
    const endpoint = `/api/tasks/${task.id}`;
    const response = await request.patch(endpoint, { data: { done: true } });
    expect(response.ok()).toBe(true);
    const { task: { completedAt } } = await response.json();
    expect(completedAt).toEqual(expect.any(String));
    const read = async () => (await (await request.get("/api/tasks")).json()).tasks[0];
    await page.goto("/");
    await doneSection(page).getByText(l.doneHeading).click();
    await row(doneSection(page), task.title).getByRole("checkbox", { name: l.open }).click();
    await expect(row(openSection(page), task.title)).toBeVisible();
    expect(await read()).toMatchObject({ done: true, completedAt });
    const status = page.getByRole("status");
    await status.getByRole("button", { name: l.undo, exact: true }).click();
    await expect(row(openSection(page), task.title)).toHaveCount(0);
    expect(await read()).toMatchObject({ done: true, completedAt });

    await doneSection(page).getByText(l.doneHeading).click();
    await row(doneSection(page), task.title).getByRole("checkbox", { name: l.open }).click();
    await status.getByRole("button", { name: l.dismiss, exact: true }).click();
    await expect.poll(read).toMatchObject({ done: false, completedAt: null });
  });

  test(`completing and reopening a task can be undone from the notice in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seed(request, [{ title: "Write report" }, { title: "Other task" }]);
    await page.goto("/");
    const status = page.getByRole("status");
    const undo = status.getByRole("button", { name: l.undo, exact: true });
    const task = row(openSection(page), "Write report");
    const listTop = (await openSection(page).boundingBox())!.y;
    await task.getByRole("checkbox", { name: l.done, exact: true }).click();
    await expect(task).toHaveCount(0);
    // The notice names the task, and the button names the key that does the same.
    await expect(status).toContainText(l.completed("Write report"));
    await expect(undo).toHaveAttribute("aria-keyshortcuts", "Z");
    await expect(undo.locator("kbd")).toHaveText("Z");
    // A short message shares one line with its buttons.
    const centre = async (target: import("@playwright/test").Locator) => { const box = (await target.boundingBox())!; return box.y + box.height / 2; };
    expect((await status.boundingBox())!.height).toBeLessThan(60);
    expect(Math.abs(await centre(status.locator(".board-notice-text")) - await centre(status.getByRole("button", { name: l.dismiss, exact: true })))).toBeLessThan(2);
    // The notice floats, so the list stays where it was.
    expect((await openSection(page).boundingBox())!.y).toBe(listTop);
    await expect.poll(async () => (await listTasks(request))[0].done).toBe(true);
    await undo.click();
    await expect(task).toBeFocused();
    // Taking it back is said too, with nothing left to undo.
    await expect(status).toContainText(l.reopened("Write report"));
    await expect(undo).toHaveCount(0);
    await expect.poll(async () => (await listTasks(request))[0].done).toBe(false);

    await task.getByRole("checkbox", { name: l.done, exact: true }).click();
    await doneSection(page).getByText(l.doneHeading).click();
    await row(doneSection(page), "Write report").getByRole("checkbox", { name: l.open, exact: true }).click();
    await expect(status).toContainText(l.reopened("Write report"));
    await page.locator("main").focus();
    await page.keyboard.press("z");
    await expect(row(openSection(page), "Write report")).toHaveCount(0);
    await expect.poll(async () => (await listTasks(request))[0].done).toBe(true);
  });

  test(`Undo takes back one action after another, newest first, in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seed(request, [{ title: "First" }, { title: "Second" }, { title: "Third" }]);
    await page.goto("/");
    const status = page.getByRole("status");
    const open = openSection(page);
    await row(open, "First").focus();
    await page.keyboard.press("Space");
    await expect(row(open, "Second")).toBeFocused();
    await page.keyboard.press("Space");
    await expect(row(open, "Third")).toBeFocused();
    await page.keyboard.press("Delete");
    await expect(status).toContainText(l.deleted("Third"));
    // With no row left the keyboard stays on the board, where the undo key still works.
    await expect(composerOrEmptyAction(page)).toBeFocused();
    await expect.poll(async () => (await listTasks(request)).map((task) => task.done)).toEqual([true, true, false]);

    await page.keyboard.press("z");
    await expect(row(open, "Third")).toBeFocused();
    await expect(status).toContainText(`${l.restored("Third")} ${l.completed("Second")}`);
    await page.keyboard.press("z");
    await expect(row(open, "Second")).toBeFocused();
    await expect(status).toContainText(`${l.reopened("Second")} ${l.completed("First")}`);
    await page.keyboard.press("z");
    await expect(row(open, "First")).toBeFocused();
    await expect(status).toContainText(l.reopened("First"));
    await expect(status.getByRole("button", { name: l.undo, exact: true })).toHaveCount(0);
    // Nothing more to take back: the key is left alone.
    await page.keyboard.press("z");
    await expect.poll(async () => (await listTasks(request)).map((task) => task.done)).toEqual([false, false, false]);
  });

  test(`a repeating task is completed for good only once Undo is out of reach, in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    const [repeating] = await seed(request, [{ title: "Daily report", due: "2026-11-17", repeat: { frequency: "daily" } }, { title: "Fragile" }]);
    await page.goto("/");
    const status = page.getByRole("status");
    const open = openSection(page);
    await row(open, "Daily report").getByRole("checkbox", { name: l.done, exact: true }).click();
    await expect(status).toContainText(`${l.completed("Daily report")} ${l.next}`);
    await expect(row(open, "Daily report")).toHaveCount(0);
    // Nothing was sent yet, so taking it back leaves no next task behind.
    expect((await listTasks(request)).map((task) => task.done)).toEqual([false, false]);
    await status.getByRole("button", { name: l.undo, exact: true }).click();
    await expect(row(open, "Daily report")).toBeFocused();
    expect(await listTasks(request)).toHaveLength(2);

    // Reopening it from the Done list while it still waits also takes the completion back.
    await row(open, "Daily report").getByRole("checkbox", { name: l.done, exact: true }).click();
    await doneSection(page).getByText(l.doneHeading).click();
    await row(doneSection(page), "Daily report").getByRole("checkbox", { name: l.open, exact: true }).click();
    await expect(status).toContainText(l.reopened("Daily report"));
    await expect(row(open, "Daily report")).toBeVisible();
    await status.getByRole("button", { name: l.dismiss, exact: true }).click();
    expect((await listTasks(request)).map((task) => task.done)).toEqual([false, false]);

    // Once the notice is gone the completion is saved and the next task arrives.
    await row(open, "Daily report").getByRole("checkbox", { name: l.done, exact: true }).click();
    await status.getByRole("button", { name: l.dismiss, exact: true }).click();
    await expect.poll(async () => (await listTasks(request)).map((task) => [task.title, task.due, task.done]))
      .toEqual([["Daily report", "2026-11-17", true], ["Fragile", null, false], ["Daily report", "2026-11-18", false]]);
    expect((await listTasks(request)).find((task) => task.id === repeating.id)?.done).toBe(true);
    await expect(row(open, "Daily report")).toBeVisible();
  });

  test(`a save that failed says so and can be sent again in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seed(request, [{ title: "Fragile" }]);
    await page.goto("/");
    const status = page.getByRole("status");
    let failing = true;
    await page.route("**/api/tasks/*", (route) => failing && route.request().method() === "PATCH"
      ? route.fulfill({ status: 500, json: { error: "generic" } }) : route.fallback());
    await row(openSection(page), "Fragile").getByRole("checkbox", { name: l.done, exact: true }).click();
    await expect(status).toContainText(l.error);
    await expect(status.getByRole("button", { name: l.undo, exact: true })).toHaveCount(0);
    await expect(row(openSection(page), "Fragile")).toBeVisible();
    expect((await listTasks(request))[0].done).toBe(false);
    failing = false;
    await status.getByRole("button", { name: l.retry, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(row(openSection(page), "Fragile")).toHaveCount(0);
    // The button went away with the notice; the keyboard is back on the board, not nowhere.
    await expect(page.locator("main")).toBeFocused();
    await expect.poll(async () => (await listTasks(request))[0].done).toBe(true);
    await expect(status).toHaveText("");
    // A refusal is not worth sending again, so it offers no Retry.
    await page.route("**/api/tasks/*", (route) => route.request().method() === "PATCH"
      ? route.fulfill({ status: 404, json: { error: "not_found" } }) : route.fallback());
    await doneSection(page).getByText(l.doneHeading).click();
    await row(doneSection(page), "Fragile").getByRole("checkbox", { name: l.open, exact: true }).click();
    await expect(status.getByRole("button", { name: l.dismiss, exact: true })).toBeVisible();
    await expect(status.getByRole("button", { name: l.retry, exact: true })).toHaveCount(0);
  });

  test(`a due date changed in the list is said and taken back as one change in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seed(request, [{ title: "Pay rent", due: "2026-11-20" }]);
    await page.goto("/");
    const status = page.getByRole("status");
    const task = row(openSection(page), "Pay rent");
    const date = task.getByLabel(l.setDate, { exact: true });
    // Two changes in a row, as when a date is stepped with the arrow keys.
    await date.fill("2026-11-25");
    await date.fill("2026-11-27");
    await expect(status).toContainText(l.due("Pay rent", l.later));
    await expect.poll(async () => (await listTasks(request))[0].due).toBe("2026-11-27");
    await status.getByRole("button", { name: l.undo, exact: true }).click();
    await expect(status).toContainText(l.due("Pay rent", l.friday));
    await expect(status.getByRole("button", { name: l.undo, exact: true })).toHaveCount(0);
    await expect.poll(async () => (await listTasks(request))[0].due).toBe("2026-11-20");
    // Back at the date it had, there is nothing to undo.
    await date.fill("2026-11-25");
    await date.fill("2026-11-20");
    await expect(status).toHaveText("");
    // From the date field itself, which keeps no history of its own, the undo chord takes the change back.
    await date.fill("2026-11-26");
    await expect.poll(async () => (await listTasks(request))[0].due).toBe("2026-11-26");
    await date.focus();
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(async () => (await listTasks(request))[0].due).toBe("2026-11-20");
  });
}

const composerOrEmptyAction = (page: import("@playwright/test").Page) => page.getByRole("button", { name: /^(Add a task|Adicionar uma tarefa)$/ });

test("every change held for Undo is sent when the page is reloaded or hidden", async ({ page, request }) => {
  await seed(request, [
    { title: "Delete one" }, { title: "Delete two" }, { title: "Repeats", due: "2026-11-17", repeat: { frequency: "daily" } }, { title: "Later" }, { title: "Stays" },
  ]);
  await page.goto("/");
  const open = openSection(page);
  const stored = async () => (await listTasks(request)).map((task) => `${task.title}:${task.done ? "done" : "open"}`).sort();
  await row(open, "Repeats").focus();
  await page.keyboard.press("Space");
  await row(open, "Delete one").focus();
  await page.keyboard.press("Delete");
  await row(open, "Delete two").focus();
  await page.keyboard.press("Delete");
  // All three are only shown so far.
  expect(await stored()).toEqual(["Delete one:open", "Delete two:open", "Later:open", "Repeats:open", "Stays:open"]);
  await page.reload();
  await expect.poll(stored).toEqual(["Later:open", "Repeats:done", "Repeats:open", "Stays:open"]);
  await expect(row(open, "Delete one")).toHaveCount(0);

  // With a mouse, a glance at another tab keeps the chance to undo: the page will hear when it is closed.
  await row(open, "Later").focus();
  await page.keyboard.press("Delete");
  await expect(page.getByRole("status")).toContainText("Deleted “Later”.");
  await hide(page);
  await expect(page.getByRole("status")).toContainText("Deleted “Later”.");
  expect(await stored()).toEqual(["Later:open", "Repeats:done", "Repeats:open", "Stays:open"]);
  await page.keyboard.press("z");
  await expect(row(open, "Later")).toBeFocused();
});

/** What the page is told when its tab stops being the one on screen. */
const hide = (page: import("@playwright/test").Page) => page.evaluate(() => {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
});

test("a notice leaves on its own, waits while the pointer is on it, and then lets a deletion through", async ({ page, request }) => {
  await seed(request, [{ title: "Short lived" }, { title: "Stays" }]);
  await page.goto("/");
  const status = page.getByRole("status");
  const task = row(openSection(page), "Short lived");
  await task.focus();
  await page.keyboard.press("Delete");
  await expect(status).toContainText("Deleted “Short lived”.");
  await status.hover();
  await page.waitForTimeout(6500);
  await expect(status).toContainText("Deleted “Short lived”.");
  expect(await listTasks(request)).toHaveLength(2);
  await page.getByRole("heading", { level: 1 }).hover();
  await expect(status).toHaveText("", { timeout: 9000 });
  await expect.poll(async () => (await listTasks(request)).map((item) => item.title)).toEqual(["Stays"]);
  // An error does not leave on its own.
  await page.route("**/api/tasks/*", (route) => route.fulfill({ status: 500, json: { error: "generic" } }));
  await row(openSection(page), "Stays").getByRole("checkbox").click();
  await expect(status).toContainText("Something went wrong. Try again.");
  await page.waitForTimeout(6500);
  await expect(status).toContainText("Something went wrong. Try again.");
});

test("dismissing the notice hands the keyboard back to where it was", async ({ page, request }) => {
  await seed(request, [{ title: "First" }, { title: "Second" }]);
  await page.goto("/");
  const status = page.getByRole("status");
  await row(openSection(page), "First").focus();
  await page.keyboard.press("Space");
  await expect(row(openSection(page), "Second")).toBeFocused();
  const dismiss = status.getByRole("button", { name: "Dismiss", exact: true });
  await dismiss.focus();
  await page.keyboard.press("Enter");
  await expect(status).toHaveText("");
  await expect(row(openSection(page), "Second")).toBeFocused();
});

test("the notice fits a phone and its controls are easy to touch", async ({ page, request }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await seed(request, [{ title: "A task with a title long enough to wrap on a narrow phone screen" }]);
  await page.goto("/");
  await page.getByRole("checkbox", { name: "Mark as done" }).click();
  const status = page.getByRole("status");
  await expect(status).toContainText("Completed “A task with a title long enough");
  for (const name of ["Undo", "Dismiss"]) {
    const box = await status.getByRole("button", { name, exact: true }).boundingBox();
    expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(44);
  }
  const bounds = await status.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  // The message wraps instead of being cut, and a touch screen is not shown a key.
  const text = status.locator(".board-notice-text");
  expect(await text.evaluate((node) => node.scrollHeight <= node.clientHeight + 1 && node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await expect(text).toHaveAttribute("title", /long enough to wrap on a narrow phone screen/);
  // Changing list keeps the chance to undo.
  await sidebar(page).getByRole("button", { name: /^Today,/ }).click();
  await expect(status).toContainText("Completed “A task with a title long enough");
  await status.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await listTasks(request))[0].done).toBe(false);
});

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("the notice names no key", async ({ page, request }) => {
    await seed(request, [{ title: "Tap me" }]);
    await page.goto("/");
    await page.getByRole("checkbox", { name: "Mark as done" }).tap();
    const undo = page.getByRole("status").getByRole("button", { name: "Undo", exact: true });
    await expect(undo).toBeVisible();
    await expect(undo.locator("kbd")).toBeHidden();
    // Short enough for one line, so it takes one line here too.
    expect((await page.getByRole("status").boundingBox())!.height).toBeLessThan(64);
  });

  test("hiding the page sends what was held, because a hidden page there may never come back", async ({ page, request }) => {
    await seed(request, [{ title: "Daily", due: "2026-11-17", repeat: { frequency: "daily" } }, { title: "Stays" }]);
    await page.goto("/");
    await row(openSection(page), "Daily").getByRole("checkbox", { name: "Mark as done" }).tap();
    await expect(page.getByRole("status")).toContainText("Completed “Daily”.");
    expect((await listTasks(request)).map((task) => task.done)).toEqual([false, false]);
    await hide(page);
    await expect(page.getByRole("status")).toHaveText("");
    await expect.poll(async () => (await listTasks(request)).map((task) => `${task.title}:${task.due}:${task.done}`))
      .toEqual(["Daily:2026-11-17:true", "Stays:null:false", "Daily:2026-11-18:false"]);
  });
});
