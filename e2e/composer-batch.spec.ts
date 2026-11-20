import { chips, composer, composerForm, expect, listTasks, openSection, pickChip, row, saveSettings, test, TOMORROW, tagChip } from "./support";

for (const l of [
  { locale: "en", preview: "Quick-add preview", count: "3 tasks, one per line", addAll: "Add 3 tasks", join: "Make it one task", priority: "Priority", low: "Low",
    high: "High", tomorrow: "Tomorrow", error: "Something went wrong. Try again." },
  { locale: "pt-BR", preview: "Prévia das tarefas", count: "3 tarefas, uma por linha", addAll: "Adicionar 3 tarefas", join: "Juntar em uma tarefa", priority: "Prioridade", low: "Baixa",
    high: "Alta", tomorrow: "Amanhã", error: "Algo deu errado. Tente novamente." },
] as const) {
  test(`pasted lines are offered as one task each or joined in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await page.goto("/");
    const field = composer(page);
    await field.focus();
    // Arrives in one piece, as a paste does.
    await page.keyboard.insertText("Buy milk #home\n\nCall Ana @amanha !alta\nSend report");
    const panel = composerForm(page).getByRole("region", { name: l.preview });
    await expect(panel.getByText(l.count)).toBeVisible();
    const lines = panel.getByRole("listitem");
    await expect(lines).toHaveCount(3);
    await expect(lines.nth(0)).toContainText("Buy milk");
    await expect(lines.nth(0)).toContainText("#home");
    await expect(lines.nth(1)).toContainText(l.high);
    await expect(lines.nth(1)).toContainText(l.tomorrow);
    // With several lines the chips are defaults for every line.
    await pickChip(page, l.priority, l.low);
    await expect(field).toHaveValue("Buy milk #home\n\nCall Ana @amanha !alta\nSend report");
    await expect(lines.nth(0)).toContainText(l.low);
    await expect(lines.nth(1)).toContainText(l.high);

    await panel.getByRole("button", { name: l.join, exact: true }).click();
    await expect(panel).toHaveCount(0);
    await expect(field).toHaveValue("Buy milk #home Call Ana @amanha !alta Send report");
    await expect(field).toBeFocused();
    await expect(tagChip(page, "home")).toBeVisible();
    await field.fill("One\nTwo @amanha\nThree");
    await expect(panel.getByText(l.count)).toBeVisible();
    await panel.getByRole("button", { name: l.addAll, exact: true }).click();
    for (const title of ["One", "Two", "Three"]) await expect(row(openSection(page), title)).toBeVisible();
    await expect(panel).toHaveCount(0);
    expect((await listTasks(request)).map(({ title, due, priority }) => ({ title, due, priority }))).toEqual([
      { title: "One", due: null, priority: "low" }, { title: "Two", due: TOMORROW, priority: "low" }, { title: "Three", due: null, priority: "low" },
    ]);
  });

  test(`a failed batch keeps every line in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await page.goto("/");
    await page.route("**/api/tasks", (route) => route.request().method() === "POST"
      ? route.fulfill({ status: 500, json: { error: "generic" } }) : route.fallback());
    const field = composer(page);
    await field.fill("One\nTwo\nThree");
    await composerForm(page).getByRole("button", { name: l.addAll, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(l.error);
    await expect(field).toHaveValue("One\nTwo\nThree");
    await expect(composerForm(page).getByText(l.count)).toBeVisible();
    expect(await listTasks(request)).toEqual([]);
  });
}
