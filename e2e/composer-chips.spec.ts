import { chip, chips, composer, expect, listTasks, openSection, pickChip, row, saveSettings, seedProjects, sidebar, test, TODAY, TOMORROW, tagChip } from "./support";

for (const l of [
  { locale: "en", priority: "Priority", high: "High", medium: "Medium", low: "Low", due: "Due date", today: "Today", tomorrow: "Tomorrow", nextWeek: "Next week", noDate: "No date",
    planned: "Planned day", noPlan: "No planned day", project: "Project", noProject: "No project", estimate: "Estimate", hour: "1 hour", half: "30 minutes", noEstimate: "No estimate",
    clear: (field: string) => `Clear ${field.toLowerCase()}`, removeTag: "Remove tag #work", dueField: "New task due date", picked: "Nov 25", pick: "Pick a date…",
    added: (title: string) => `Added “${title}”.`, show: "Show", viewProject: /^Project: Acme,/, error: "Something went wrong. Try again.",
    note: "14:00 is saved as afternoon. A due date keeps the day, not the hour.", partOfDay: "Part of day", morning: "Morning", afternoon: "Afternoon", evening: "Evening", anyTime: "Any time",
    repeat: "Repeat", weekly: "Weekly", monthly: "Monthly", friday: "Nov 20", heard: "Due date: Tomorrow · Afternoon. Priority: High. Tags: #work" },
  { locale: "pt-BR", priority: "Prioridade", high: "Alta", medium: "Média", low: "Baixa", due: "Prazo", today: "Hoje", tomorrow: "Amanhã", nextWeek: "Próxima semana", noDate: "Sem data",
    planned: "Dia planejado", noPlan: "Sem dia planejado", project: "Projeto", noProject: "Sem projeto", estimate: "Estimativa", hour: "1 hora", half: "30 minutos", noEstimate: "Sem estimativa",
    clear: (field: string) => `Limpar ${field.toLowerCase()}`, removeTag: "Remover etiqueta #work", dueField: "Prazo da nova tarefa", picked: "25 de nov.", pick: "Escolher data…",
    added: (title: string) => `“${title}” adicionada.`, show: "Mostrar", viewProject: /^Projeto: Acme,/, error: "Algo deu errado. Tente novamente.",
    note: "14:00 é salvo como tarde. O prazo guarda o dia, não a hora.", partOfDay: "Período do dia", morning: "Manhã", afternoon: "Tarde", evening: "Noite", anyTime: "Qualquer horário",
    repeat: "Repetir", weekly: "Semanalmente", monthly: "Mensalmente", friday: "20 de nov.", heard: "Prazo: Amanhã · Tarde. Prioridade: Alta. Etiquetas: #work" },
] as const) {
  test(`chips mirror typed tokens and keep text and values in step in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await page.goto("/");
    const field = composer(page);
    const named = (name: string) => chips(page).getByRole("button", { name, exact: true });
    await field.fill("Call !alta @amanha 14h #work t30m");
    await expect(chip(page, l.priority)).toHaveAccessibleName(`${l.priority}: ${l.high}`);
    await expect(chip(page, l.due)).toHaveAccessibleName(`${l.due}: ${l.tomorrow} · ${l.afternoon}`);
    await expect(chip(page, l.due)).toHaveAccessibleDescription(l.note);
    await expect(chip(page, l.estimate)).toHaveAccessibleName(`${l.estimate}: ${l.half}`);
    await expect(chip(page, l.planned)).toHaveAccessibleName(l.planned);

    await named(l.clear(l.priority)).click();
    await expect(field).toHaveValue("Call @amanha 14h #work t30m");
    await expect(chip(page, l.priority)).toHaveAccessibleName(l.priority);
    await expect(field).toBeFocused();

    // The typed date and time were one token: the chip takes both and keeps the part the pointer did not change.
    await pickChip(page, l.due, l.today);
    await expect(field).toHaveValue("Call #work t30m");
    await expect(chip(page, l.due)).toHaveAccessibleName(`${l.due}: ${l.today} · ${l.afternoon}`);
    await pickChip(page, l.due, l.anyTime);
    await expect(chip(page, l.due)).toHaveAccessibleName(`${l.due}: ${l.today}`);

    await named(l.removeTag).click();
    await expect(field).toHaveValue("Call t30m");
    await expect(tagChip(page, "work")).toHaveCount(0);

    await pickChip(page, l.estimate, l.hour);
    await expect(field).toHaveValue("Call");
    await expect(chip(page, l.estimate)).toHaveAccessibleName(`${l.estimate}: ${l.hour}`);

    // Typing a token again takes the field back from the chip.
    await field.pressSequentially(" !baixa");
    await expect(chip(page, l.priority)).toHaveAccessibleName(`${l.priority}: ${l.low}`);
    await pickChip(page, l.planned, l.tomorrow);
    await page.getByLabel(l.dueField).fill("2026-11-25");
    await expect(chip(page, l.due)).toHaveAccessibleName(`${l.due}: ${l.picked}`);
    await field.press("Enter");
    await expect(row(openSection(page), "Call")).toBeVisible();
    await expect(chips(page).locator("[data-filled]")).toHaveCount(0);
    expect(await listTasks(request)).toMatchObject([
      { title: "Call", priority: "low", due: "2026-11-25", plannedFor: TOMORROW, tags: [], estimateHours: 1, partOfDay: null },
    ]);
  });

  test(`a chip menu works from the keyboard and returns to the field in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await page.goto("/");
    const field = composer(page);
    await field.fill("Plan the week");
    const priority = chip(page, l.priority);
    await priority.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu", { name: l.priority, exact: true });
    const items = menu.getByRole("menuitemradio");
    // Each option shows the key that picks it.
    await expect(items).toHaveText([`${l.high}1`, `${l.medium}2`, `${l.low}3`]);
    await expect(menu.getByRole("menuitemradio", { name: l.high, exact: true })).toBeVisible();
    await expect(priority).toHaveAttribute("aria-expanded", "true");
    await expect(items.nth(0)).toBeFocused();
    await expect(items.nth(0)).toHaveAttribute("aria-keyshortcuts", "1");
    await page.keyboard.press("ArrowDown");
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press("End");
    await expect(items.nth(2)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(items.nth(0)).toBeFocused();
    await page.keyboard.press(l.medium[0].toLowerCase());
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(priority).toBeFocused();
    await expect(priority).toHaveAccessibleName(l.priority);

    await page.keyboard.press("Enter");
    await page.keyboard.press("2");
    await expect(menu).toBeHidden();
    await expect(priority).toHaveAccessibleName(`${l.priority}: ${l.medium}`);
    await expect(field).toBeFocused();
    await priority.click();
    await expect(items.nth(1)).toHaveAttribute("aria-checked", "true");
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(priority).toHaveAccessibleName(`${l.priority}: ${l.high}`);

    const due = chip(page, l.due);
    await due.click();
    const days = page.getByRole("menu", { name: l.due, exact: true });
    await expect(days.getByRole("menuitemradio")).toHaveText([l.today, l.tomorrow, l.nextWeek, l.noDate, l.morning, l.afternoon, l.evening, l.anyTime]);
    // An empty chip starts at the top of its choices, and the second set is a named group.
    await expect(days.getByRole("menuitemradio").first()).toBeFocused();
    await expect(days.getByRole("group", { name: l.partOfDay, exact: true }).getByRole("menuitemradio")).toHaveCount(4);
    await expect(days.getByRole("menuitem", { name: l.pick, exact: true })).toBeVisible();
    await days.getByRole("menuitemradio", { name: l.nextWeek, exact: true }).click();
    await field.press("Enter");
    await expect(row(openSection(page), "Plan the week")).toBeVisible();
    expect(await listTasks(request)).toMatchObject([{ title: "Plan the week", priority: "high", due: "2026-11-23" }]);
  });

  test(`a chip can drop what the view adds and the save is confirmed in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale, startView: "today" });
    await page.goto("/");
    await expect(chips(page).getByRole("button", { name: l.project, exact: true })).toHaveCount(0);
    const [acme] = await seedProjects(request, ["Acme", "Beta"]);
    await page.reload();
    const field = composer(page);
    await expect(chip(page, l.planned)).toHaveAccessibleName(`${l.planned}: ${l.today}`);
    await field.fill("Planned here");
    await field.press("Enter");
    await expect(row(openSection(page), "Planned here")).toBeVisible();
    await expect(page.getByRole("status")).toContainText(l.added("Planned here"));

    await field.fill("Planned elsewhere");
    await chips(page).getByRole("button", { name: l.clear(l.planned), exact: true }).click();
    await expect(chip(page, l.planned)).toHaveAccessibleName(l.planned);
    await field.press("Enter");
    // The chip sent the task out of this list: the notice names it and can take the person to it.
    await expect(page.getByRole("status")).toContainText(l.added("Planned elsewhere"));
    await expect(page.getByRole("status").getByRole("button", { name: l.show, exact: true })).toBeVisible();
    await expect(row(openSection(page), "Planned elsewhere")).toHaveCount(0);
    // The next task follows the view again.
    await expect(chip(page, l.planned)).toHaveAccessibleName(`${l.planned}: ${l.today}`);

    await sidebar(page).getByRole("button", { name: l.viewProject }).click();
    await expect(chip(page, l.project)).toHaveAccessibleName(`${l.project}: Acme`);
    await field.fill("For Beta");
    await pickChip(page, l.project, "Beta");
    await field.press("Enter");
    await expect(page.getByRole("status")).toContainText(l.added("For Beta"));
    await field.fill("No project");
    await pickChip(page, l.project, l.noProject);
    await field.press("Enter");
    await expect(page.getByRole("status")).toContainText(l.added("No project"));
    await field.fill("For Acme");
    await field.press("Enter");
    await expect(row(openSection(page), "For Acme")).toBeVisible();
    const saved = new Map((await listTasks(request)).map((task) => [task.title, task]));
    expect(saved.get("Planned here")).toMatchObject({ plannedFor: TODAY, projectId: null });
    expect(saved.get("Planned elsewhere")).toMatchObject({ plannedFor: null });
    expect(saved.get("For Beta")?.projectId).not.toBe(acme.id);
    expect(saved.get("For Beta")?.projectId).not.toBeNull();
    expect(saved.get("No project")).toMatchObject({ projectId: null });
    expect(saved.get("For Acme")).toMatchObject({ projectId: acme.id, plannedFor: null });
  });

  test(`a repeating task starts from its date, or from today when it has none, in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await page.goto("/");
    const field = composer(page);
    await field.fill("Water the plants");
    await pickChip(page, l.repeat, l.weekly);
    await expect(chip(page, l.repeat)).toHaveAccessibleName(`${l.repeat}: ${l.weekly}`);
    // Repeating needs a date to start from, and the chip shows which one it will be.
    await expect(chip(page, l.due)).toHaveAccessibleName(`${l.due}: ${l.today}`);
    await chips(page).getByRole("button", { name: l.clear(l.repeat), exact: true }).click();
    await expect(chip(page, l.repeat)).toHaveAccessibleName(l.repeat);
    await expect(chip(page, l.due)).toHaveAccessibleName(l.due);
    await pickChip(page, l.repeat, l.weekly);
    await field.press("Enter");
    await expect(row(openSection(page), "Water the plants")).toBeVisible();
    await field.fill("Pay the rent @sex");
    await pickChip(page, l.repeat, l.monthly);
    await expect(chip(page, l.due)).toHaveAccessibleName(`${l.due}: ${l.friday}`);
    await field.press("Enter");
    await expect(row(openSection(page), "Pay the rent")).toBeVisible();
    expect((await listTasks(request)).map(({ title, due, repeat }) => ({ title, due, repeat }))).toEqual([
      { title: "Water the plants", due: TODAY, repeat: { frequency: "weekly", days: [2] } },
      { title: "Pay the rent", due: "2026-11-20", repeat: { frequency: "monthly", day: 20 } },
    ]);
  });

  test(`the due date chip sets the part of the day and both day chips say which they are in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await page.goto("/");
    const field = composer(page);
    await field.fill("Call the bank");
    // A part of the day belongs to a day: with no date picked or typed, that day is today.
    await pickChip(page, l.due, l.afternoon);
    await expect(field).toBeFocused();
    await expect(chip(page, l.due)).toHaveAccessibleName(`${l.due}: ${l.today} · ${l.afternoon}`);
    await pickChip(page, l.planned, l.today);
    // Both chips hold today, so each shows its own label beside the value.
    await expect(chip(page, l.due)).toHaveText(`${l.due}: ${l.today} · ${l.afternoon}`);
    await expect(chip(page, l.planned)).toHaveText(`${l.planned}: ${l.today}`);
    await pickChip(page, l.due, l.tomorrow);
    await expect(chip(page, l.due)).toHaveAccessibleName(`${l.due}: ${l.tomorrow} · ${l.afternoon}`);
    await field.press("Enter");
    await expect(row(openSection(page), "Call the bank")).toBeVisible();
    // A typed time wins over the part that was picked; clearing the chip clears both.
    await field.fill("Call again @sex 9h");
    await pickChip(page, l.due, l.evening);
    await expect(field).toHaveValue("Call again");
    await expect(chip(page, l.due)).toHaveAccessibleName(`${l.due}: ${l.friday} · ${l.evening}`);
    await chips(page).getByRole("button", { name: l.clear(l.due), exact: true }).click();
    await expect(chip(page, l.due)).toHaveAccessibleName(l.due);
    await field.press("Enter");
    await expect(row(openSection(page), "Call again")).toBeVisible();
    expect((await listTasks(request)).map(({ title, due, partOfDay, plannedFor }) => ({ title, due, partOfDay, plannedFor }))).toEqual([
      { title: "Call the bank", due: TOMORROW, partOfDay: "afternoon", plannedFor: TODAY },
      { title: "Call again", due: null, partOfDay: null, plannedFor: null },
    ]);
  });

  test(`what was understood is said once the typing pauses, and the chips keep their labels on a phone in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const field = composer(page);
    const heard = chips(page).locator("[aria-live='polite']");
    await expect(heard).toHaveText("");
    for (const name of [l.planned, l.due, l.priority, l.estimate, l.repeat]) await expect(chip(page, name)).toHaveText(name);
    await field.pressSequentially("Call !alta @amanha 14h #work");
    // Not yet: a reader would hear every keystroke.
    await expect(heard).toHaveText("");
    await expect(heard).toHaveText(l.heard);
    // The calendar fields only lend their picker to the menu, so they stay out of what is read.
    await expect(page.getByLabel(l.dueField)).toHaveAttribute("aria-hidden", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });

  test(`a failed save brings the chip choices back in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await page.goto("/");
    await page.route("**/api/tasks", (route) => route.request().method() === "POST"
      ? route.fulfill({ status: 500, json: { error: "generic" } }) : route.fallback());
    const field = composer(page);
    await field.fill("Will fail");
    await pickChip(page, l.priority, l.high);
    await pickChip(page, l.estimate, l.half);
    await field.press("Enter");
    await expect(page.getByRole("status")).toHaveText(l.error);
    await expect(field).toHaveValue("Will fail");
    await expect(chip(page, l.priority)).toHaveAccessibleName(`${l.priority}: ${l.high}`);
    await expect(chip(page, l.estimate)).toHaveAccessibleName(`${l.estimate}: ${l.half}`);
    expect(await listTasks(request)).toEqual([]);
  });
}
