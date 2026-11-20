import { closeTaskPanel, composer, expect, listTasks, openSection, row, saveSettings, seed, taskDetails, taskPanel, test } from "./support";

for (const l of [
  { locale: "en", edit: "Edit title", error: "Something went wrong. Try again.", deleted: "Deleted “Third task”.", restored: "Restored “Third task”.", dismiss: "Dismiss",
    add: "Add a task", search: "Search this list" },
  { locale: "pt-BR", edit: "Editar título", error: "Algo deu errado. Tente novamente.", deleted: "“Third task” excluída.", restored: "“Third task” restaurada.", dismiss: "Dispensar",
    add: "Adicionar uma tarefa", search: "Pesquisar nesta lista" },
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
    const edit = page.getByRole("combobox", { name: l.edit });
    await expect(edit).toBeFocused();
    await edit.fill("First task renamed");
    await edit.press("Enter");
    const renamed = row(openSection(page), "First task renamed");
    // An edit started from the row hands the keyboard back to the row.
    await expect(renamed).toBeFocused();
    await expect.poll(async () => (await listTasks(request)).map((task) => task.title)).toContain("First task renamed");

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

    // Delete hides the task at once and nothing is removed while it can be undone.
    await page.keyboard.press("Delete");
    await expect(third).toBeHidden();
    await expect(page.getByRole("status")).toContainText(l.deleted);
    expect(await listTasks(request)).toHaveLength(3);
    // The list is empty and the keyboard stays on the board, where the undo key is a key and not a letter.
    await expect(page.getByRole("button", { name: l.add, exact: true })).toBeFocused();
    await page.keyboard.press("z");
    await expect(third).toBeFocused();
    await expect(page.getByRole("status")).toContainText(l.restored);
    // From the task field, with nothing typed, the same undo is Ctrl or ⌘ with Z.
    await page.keyboard.press("Delete");
    await page.keyboard.press("n");
    await expect(composer(page)).toBeFocused();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(third).toBeFocused();
    // Text the person typed and then cleared is theirs to bring back first.
    await page.keyboard.press("Backspace");
    await expect(third).toBeHidden();
    await page.keyboard.press("n");
    await page.keyboard.type("Draft");
    await page.keyboard.press("Escape");
    await expect(composer(page)).toHaveValue("");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(composer(page)).toHaveValue("Draft");
    await expect(third).toBeHidden();
    await page.getByRole("status").getByRole("button", { name: l.dismiss, exact: true }).click();
    await expect.poll(async () => (await listTasks(request)).map((task) => task.title).sort()).toEqual(["First task renamed", "Second task"]);
  });

  test(`Escape steps back from the search and from the details without losing the place in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seed(request, [{ title: "First task", due: "2026-11-18" }, { title: "Second task", due: "2026-11-19" }, { title: "Third thing", due: "2026-11-20" }]);
    await page.goto("/");
    const [first, second, third] = ["First task", "Second task", "Third thing"].map((title) => row(openSection(page), title));
    const search = page.getByRole("searchbox", { name: l.search });
    await expect(first).toBeVisible();
    await page.keyboard.press("/");
    await expect(search).toBeFocused();
    await page.keyboard.type("task");
    await expect(third).toBeHidden();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("j");
    await expect(second).toBeFocused();
    // On a task, Escape clears the search and the keyboard stays on that task.
    await page.keyboard.press("Escape");
    await expect(search).toHaveValue("");
    await expect(third).toBeVisible();
    await expect(second).toBeFocused();
    // With no search left, it closes the details that are open.
    await page.keyboard.press("e");
    await expect(taskPanel(page)).toBeVisible();
    await second.focus();
    await page.keyboard.press("Escape");
    await expect(taskPanel(page)).toBeHidden();
    // In the search itself, Escape clears what was typed and then hands the keyboard to the list.
    await page.keyboard.press("/");
    await page.keyboard.type("zzz");
    await page.keyboard.press("Escape");
    await expect(search).toHaveValue("");
    await expect(search).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(first).toBeFocused();
    expect((await listTasks(request)).every((task) => !task.done)).toBe(true);
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
    await expect(page.getByRole("status")).toContainText(l.error);
    await expect(first).toBeVisible();
    expect((await listTasks(request))[0].done).toBe(false);
  });
}
