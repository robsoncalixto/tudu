import { closeTaskPanel, expect, listTasks, openSection, row, saveSettings, seed, taskDetails, taskPanel, test } from "./support";

for (const l of [
  { locale: "en", edit: "Edit title", error: "Something went wrong. Try again." },
  { locale: "pt-BR", edit: "Editar título", error: "Algo deu errado. Tente novamente." },
] as const) {
  test(`keys move through the list and act on the focused task in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seed(request, [{ title: "First task", due: "2026-11-18" }, { title: "Second task", due: "2026-11-19" }, { title: "Third task", due: "2026-11-20" }]);
    await page.goto("/");
    const [first, second, third] = ["First task", "Second task", "Third task"].map((title) => row(openSection(page), title));
    await page.locator("main").focus();
    // Arrows scroll the page until a task has focus.
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("main")).toBeFocused();
    await page.keyboard.press("j");
    await expect(first).toBeFocused();
    await page.keyboard.press("j");
    await expect(second).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(third).toBeFocused();
    await page.keyboard.press("j");
    await expect(third).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("k");
    await expect(first).toBeFocused();
    await page.keyboard.press("k");
    await expect(first).toBeFocused();

    await page.keyboard.press("Enter");
    const edit = page.getByRole("textbox", { name: l.edit });
    await expect(edit).toBeFocused();
    await edit.fill("First task renamed");
    await edit.press("Enter");
    const renamed = row(openSection(page), "First task renamed");
    await expect(renamed).toBeVisible();
    await expect.poll(async () => (await listTasks(request)).map((task) => task.title)).toContain("First task renamed");

    await renamed.focus();
    await page.keyboard.press("e");
    await expect(taskPanel(page)).toBeVisible();
    await expect(closeTaskPanel(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(taskPanel(page)).toBeHidden();
    await expect(taskDetails(renamed)).toBeFocused();

    // A letter acts from a control inside the row; Space there belongs to the control.
    await page.keyboard.press("d");
    await expect(renamed).toBeHidden();
    await expect(second).toBeFocused();
    await page.keyboard.press("Space");
    await expect(second).toBeHidden();
    await expect(third).toBeFocused();
    await expect.poll(async () => (await listTasks(request)).filter((task) => task.done).map((task) => task.title).sort())
      .toEqual(["First task renamed", "Second task"]);
  });

  test(`a failed keyboard completion keeps the task open in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seed(request, [{ title: "First task" }]);
    await page.goto("/");
    await page.route("**/api/tasks/*", (route) => route.request().method() === "PATCH"
      ? route.fulfill({ status: 500, json: { error: "generic" } }) : route.fallback());
    const first = row(openSection(page), "First task");
    await first.focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("status")).toHaveText(l.error);
    await expect(first).toBeVisible();
    expect((await listTasks(request))[0].done).toBe(false);
  });
}
