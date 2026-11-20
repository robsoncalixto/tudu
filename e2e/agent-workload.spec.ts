import { dueLabel } from "../src/lib/dates";
import { dictionaries } from "../src/i18n";
import { fixture, fixtureUrl, pending, taskDraft } from "./agent-support";
import { expect, listTasks, row, saveSettings, seed, taskDetails, taskPanel, test, TODAY, TOMORROW } from "./support";

for (const locale of ["en", "pt-BR"] as const) {
  const t = dictionaries[locale];
  test(`suggests a working day and period using saved workload in ${locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale, aiProvider: "openai", aiModel: "test-agent", workingDays: [2, 3], workHoursPerDay: 4 });
    await seed(request, [{ title: "Full day", due: TODAY, estimateHours: 4, partOfDay: "morning" }]);
    await fixture(request, [
      { kind: "create_task", task: { ...taskDraft, title: "Unscheduled report", due: null, plannedFor: null, estimateHours: 2 }, reason: "Plan the report." },
      { kind: "create_task", task: { ...taskDraft, title: "Explicit deadline", due: "2026-11-20" }, reason: "Keep Friday." },
    ]);
    await page.goto("/agent");
    await page.getByRole("textbox", { name: t.agentPrompt }).fill("Plan the report and finish the other task Friday.");
    await page.getByRole("button", { name: t.agentPropose, exact: true }).click();
    const report = pending(page, locale).getByRole("article", { name: "Unscheduled report" });
    await expect(report.getByLabel(t.setDate)).toHaveValue(TOMORROW);
    await expect(report.getByLabel(t.agentPlannedFor)).toHaveValue(TOMORROW);
    await expect(report.getByRole("combobox", { name: t.partOfDay })).toHaveValue("morning");
    await expect(report).toContainText(t.agentLoadReason(dueLabel(TOMORROW, TODAY, locale, t), 4, 2));
    await expect(pending(page, locale).getByRole("article", { name: "Explicit deadline" }).getByLabel(t.setDate)).toHaveValue("2026-11-20");
    expect((await listTasks(request)).map((item) => item.title)).toEqual(["Full day"]);
    await report.getByRole("button", { name: t.agentAccept }).click();
    await expect.poll(async () => (await listTasks(request)).find((item) => item.title === "Unscheduled report"))
      .toMatchObject({ due: TOMORROW, plannedFor: TOMORROW, partOfDay: "morning", estimateHours: 2 });
    await page.goto("/");
    await taskDetails(row(page, "Unscheduled report")).click();
    const period = taskPanel(page).getByRole("combobox", { name: t.partOfDay });
    await expect(period).toHaveValue("morning");
    await period.selectOption("afternoon");
    await expect.poll(async () => (await listTasks(request)).find((item) => item.title === "Unscheduled report")?.partOfDay).toBe("afternoon");
  });

  test(`reviews overload and accepts a new period from the task in ${locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale, aiProvider: "openai", aiModel: "test-agent", workingDays: [2, 3], workHoursPerDay: 4 });
    await seed(request, [
      { title: "Fixed deadline", due: TODAY, estimateHours: 4 },
      { title: "Movable report", plannedFor: TODAY, priority: "low" },
    ]);
    expect((await request.put(fixtureUrl, { data: { plan: { summary: "Daily review", proposals: [] } } })).ok()).toBe(true);
    await page.goto("/agent");
    await page.getByRole("button", { name: t.agentReviewTasks }).click();
    await expect(page.getByText(t.agentOverloadedDays(1), { exact: false })).toBeVisible();
    await page.goto("/");
    await taskDetails(row(page, "Movable report")).click();
    const panel = taskPanel(page);
    await expect(panel.getByText(t.suggestedValue(t.partsOfDay.afternoon))).toBeVisible();
    const before = (await listTasks(request)).find(({ title }) => title === "Movable report");
    expect(before).toMatchObject({ partOfDay: null, plannedFor: TODAY });
    await panel.getByRole("button", { name: t.agentAccept }).click();
    await expect.poll(async () => (await listTasks(request)).find(({ title }) => title === "Movable report"))
      .toMatchObject({ partOfDay: "afternoon", plannedFor: TOMORROW, due: null });
  });
}
