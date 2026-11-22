import { composer, composerForm, expect, listTasks, openSection, pickChip, row, saveSettings, test, TOMORROW, tagChip } from "./support";

for (const l of [
  { locale: "en", preview: "Quick-add preview", count: "3 tasks, one per line", addAll: "Add 3 tasks", join: "Make it one task", priority: "Priority", low: "Low",
    high: "High", tomorrow: "Tomorrow", error: "Something went wrong. Try again.", add: "Add", addMany: (n: number) => `Add ${n} tasks`,
    limit: "Add up to 50 task lines at a time.", needsTitle: "Line 2 needs a title.", added: "14 tasks added" },
  { locale: "pt-BR", preview: "Prévia das tarefas", count: "3 tarefas, uma por linha", addAll: "Adicionar 3 tarefas", join: "Juntar em uma tarefa", priority: "Prioridade", low: "Baixa",
    high: "Alta", tomorrow: "Amanhã", error: "Algo deu errado. Tente novamente.", add: "Adicionar", addMany: (n: number) => `Adicionar ${n} tarefas`,
    limit: "Adicione até 50 linhas de tarefas por vez.", needsTitle: "A linha 2 precisa de um título.", added: "14 tarefas adicionadas" },
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

  for (const viewport of [{ width: 1280, height: 860 }, { width: 390, height: 844 }]) {
    test(`a long list stays inside the field and can be added with the pointer at ${viewport.width}px in ${l.locale}`, async ({ page, request }) => {
      await saveSettings(request, { locale: l.locale });
      await page.setViewportSize(viewport);
      await page.goto("/");
      const field = composer(page);
      await field.focus();
      await page.keyboard.insertText(Array.from({ length: 14 }, (_, index) => `Line ${index + 1} #t${index + 1}`).join("\n"));
      const box = page.locator(".command-field");
      const bounds = (await box.boundingBox())!;
      const chipsTop = (await page.locator(".composer-chips").boundingBox())!.y;
      // Eight lines show; the rest scroll inside the field instead of running over what is under it.
      expect(Math.round(bounds.height)).toBe(220);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(chipsTop);
      expect(await box.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
      // The marks stay on their words while the text scrolls.
      await box.evaluate((node) => { node.scrollTop = 0; });
      const aligned = await page.evaluate(() => {
        const mirror = document.querySelector(".command-mirror")!.getBoundingClientRect();
        const text = document.querySelector(".command-field textarea")!.getBoundingClientRect();
        return Math.abs(mirror.top - text.top) < 1 && Math.abs(mirror.height - text.height) < 1;
      });
      expect(aligned).toBe(true);
      // The preview scrolls too, and can be reached to scroll it from the keyboard.
      const preview = composerForm(page).getByRole("region", { name: l.preview }).getByRole("list");
      await expect(preview.getByRole("listitem")).toHaveCount(14);
      await expect(preview).toHaveAttribute("tabindex", "0");
      expect(await preview.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
      await composerForm(page).getByRole("button", { name: l.addMany(14), exact: true }).click();
      await expect(page.getByRole("status")).toContainText(l.added);
      await expect.poll(async () => (await listTasks(request)).length).toBe(14);
      expect((await listTasks(request))[13]).toMatchObject({ title: "Line 14", tags: ["t14"] });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    });
  }

  test(`a pasted list loses its markers and too many lines are refused while writing in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await page.goto("/");
    const field = composer(page);
    const panel = composerForm(page).getByRole("region", { name: l.preview });
    const feedback = composerForm(page).locator("#composer-feedback");
    await field.focus();
    await page.keyboard.insertText("- Comprar leite\n1. Enviar relatório #work\n[ ] Pagar boleto\n- [x] Arquivar");
    await expect(panel.locator(".quick-task-title")).toHaveText(["Comprar leite", "Enviar relatório", "Pagar boleto", "Arquivar"]);
    await field.press("Enter");
    await expect(row(openSection(page), "Pagar boleto")).toBeVisible();
    expect((await listTasks(request)).map((task) => task.title)).toEqual(["Comprar leite", "Enviar relatório", "Pagar boleto", "Arquivar"]);
    // A single line is left as written.
    await field.fill("- Só uma linha");
    await field.press("Enter");
    await expect(row(openSection(page), "- Só uma linha")).toBeVisible();

    // More than fifty lines: said at once, and neither way of adding is offered.
    await field.fill(Array.from({ length: 60 }, (_, index) => `Task ${index}`).join("\n"));
    await expect(feedback.getByRole("alert")).toHaveText(l.limit);
    await expect(composerForm(page).getByRole("button", { name: l.addMany(60), exact: true })).toBeDisabled();
    await expect(composerForm(page).getByRole("button", { name: l.add, exact: true })).toBeDisabled();
    await field.press("Enter");
    expect(await listTasks(request)).toHaveLength(5);
    // A line with details and no title is named by its number once the person tries to save.
    await field.fill("First\n#tag !alta");
    await expect(feedback).toHaveText("");
    await field.press("Enter");
    await expect(feedback.getByRole("alert")).toHaveText(l.needsTitle);
    await expect(page.getByRole("status")).not.toContainText(l.error);
    expect(await listTasks(request)).toHaveLength(5);
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
