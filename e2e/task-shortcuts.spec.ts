import { composer, expect, listTasks, row, saveSettings, seed, taskDetails, taskPanel, test } from "./support";

for (const l of [
  { locale: "en", help: "Keyboard shortcuts", add: "New subtask" },
  { locale: "pt-BR", help: "Atalhos de teclado", add: "Nova subtarefa" },
] as const) {
  test(`single keys no longer act on tasks in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seed(request, [{ title: "First task" }, { title: "Second task" }]);
    const before = await listTasks(request);
    await page.goto("/");
    const first = row(page, "First task");
    await first.focus();
    for (const key of ["n", "/", "j", "ArrowDown", "k", "ArrowUp", "a", "i", "x", "Delete", "Backspace", "?"]) {
      await page.keyboard.press(key);
      await expect(first).toBeFocused();
    }
    await expect(composer(page)).toHaveValue("");
    await expect(page.getByRole("textbox", { name: l.add })).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: l.help })).toHaveCount(0);
    expect(await listTasks(request)).toEqual(before);
    await taskDetails(first).press("Enter");
    await expect(taskPanel(page)).toBeVisible();
    await page.keyboard.press("i");
    await expect(taskPanel(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(taskPanel(page)).toBeHidden();
  });
}
