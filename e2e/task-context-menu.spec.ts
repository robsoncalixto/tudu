import { expect, listTasks, saveSettings, seed, test } from "./support";

for (const labels of [
  { locale: "en", menu: "Task actions", add: "Add subtask", input: "New subtask" },
  { locale: "pt-BR", menu: "Ações da tarefa", add: "Adicionar subtarefa", input: "Nova subtarefa" },
] as const) {
  test(`adds a subtask from its parent's context menu in ${labels.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: labels.locale });
    const [first, second] = await seed(request, [{ title: "Design" }, { title: "Release" }]);
    await page.goto("/");
    const parent = page.getByRole("listitem", { name: second.title, exact: true });
    const menu = page.getByRole("menu", { name: labels.menu });
    await parent.focus();
    await page.keyboard.press("Shift+F10");
    await expect(menu.getByRole("menuitem", { name: labels.add })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(parent).toBeFocused();
    await parent.getByRole("button", { name: second.title, exact: true }).click({ button: "right" });
    await menu.getByRole("menuitem", { name: labels.add }).click();
    const entry = parent.getByRole("textbox", { name: labels.input });
    await expect(entry).toBeFocused();
    await entry.fill("Check release notes");
    await entry.press("Enter");
    await expect(parent.getByRole("checkbox", { name: "Check release notes" })).toBeVisible();
    await expect.poll(async () => (await listTasks(request)).find(task => task.id === second.id)?.steps)
      .toMatchObject([{ title: "Check release notes", done: false }]);
    expect((await listTasks(request)).find(task => task.id === first.id)?.steps).toEqual([]);
  });
}
