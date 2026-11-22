import { chip, chips, composer, expect, listTasks, openSection, row, saveSettings, seed, test, tagChip } from "./support";

for (const l of [
  { locale: "en", tags: "Tags", field: "New task tag", suggestions: "Suggestions", newTag: "New tag", remove: (tag: string) => `Remove tag #${tag}`, limit: "A task can have up to 10 tags." },
  { locale: "pt-BR", tags: "Etiquetas", field: "Etiqueta da nova tarefa", suggestions: "Sugestões", newTag: "Nova etiqueta", remove: (tag: string) => `Remover etiqueta #${tag}`, limit: "Cada tarefa pode ter até 10 etiquetas." },
] as const) {
  test(`the Tags chip reuses saved tags and creates new ones in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seed(request, [{ title: "Seed", tags: ["home", "work", "writing"] }]);
    await page.goto("/");
    const field = composer(page);
    await field.fill("Draft the plan #home");
    const trigger = chip(page, l.tags);
    await trigger.click();
    const picker = page.getByRole("dialog", { name: l.tags, exact: true });
    const input = picker.getByRole("combobox", { name: l.field });
    const options = picker.getByRole("listbox", { name: l.suggestions }).getByRole("option");
    await expect(input).toBeFocused();
    // The tag typed in the field is already on the task.
    await expect(options).toHaveText(["#work", "#writing"]);
    await input.pressSequentially("wr");
    await expect(options).toHaveText(["#writing", `#wr${l.newTag}`]);
    expect(await input.getAttribute("aria-activedescendant")).toBe(await options.nth(0).getAttribute("id"));
    await input.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await input.press("ArrowUp");
    await input.press("Enter");
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await expect(tagChip(page, "writing")).toBeVisible();
    await input.fill(" #Novo ");
    await expect(options).toHaveText([`#novo${l.newTag}`]);
    await options.first().click();
    await expect(tagChip(page, "novo")).toBeVisible();
    await input.press("Escape");
    await expect(picker).toBeHidden();
    await expect(trigger).toBeFocused();

    await chips(page).getByRole("button", { name: l.remove("writing"), exact: true }).click();
    await expect(tagChip(page, "writing")).toHaveCount(0);
    await expect(field).toBeFocused();
    await chips(page).getByRole("button", { name: l.remove("home"), exact: true }).click();
    await expect(field).toHaveValue("Draft the plan");
    await field.press("Enter");
    await expect(row(openSection(page), "Draft the plan")).toBeVisible();
    expect((await listTasks(request)).find((task) => task.title === "Draft the plan")?.tags).toEqual(["novo"]);
  });

  test(`the Tags chip stops at ten tags in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await page.goto("/");
    const field = composer(page);
    await field.fill(`Plan ${Array.from({ length: 9 }, (_, index) => `#t${index}`).join(" ")}`);
    await chip(page, l.tags).click();
    const input = page.getByRole("dialog", { name: l.tags, exact: true }).getByRole("combobox", { name: l.field });
    await input.fill("ten");
    await input.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: l.limit })).toHaveCount(0);
    await input.fill("eleven");
    await input.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: l.limit })).toBeVisible();
    await expect(tagChip(page, "eleven")).toHaveCount(0);
    await input.press("Escape");
    await field.press("Enter");
    await expect(row(openSection(page), "Plan")).toBeVisible();
    expect((await listTasks(request))[0].tags).toHaveLength(10);
  });
}
