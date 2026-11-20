import { dictionaries } from "../src/i18n";
import { fixtureUrl, pending } from "./agent-support";
import { expect, listTasks, openSection, row, rowTitles, saveSettings, test, TODAY } from "./support";

for (const locale of ["en", "pt-BR"] as const) {
  const t = dictionaries[locale];
  test(`persists keyboard and dragged order across a reload in ${locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale, startView: "today" });
    expect((await request.post("/api/tasks", { data: [
      { title: "First task", plannedFor: TODAY }, { title: "Second task", plannedFor: TODAY }, { title: "Third task", plannedFor: TODAY },
    ] })).ok()).toBe(true);
    await page.goto("/");
    await expect(page.getByRole("combobox", { name: t.sortTasks })).toHaveValue("manual");
    await row(page, "Third task").getByRole("button", { name: t.moveTaskUp }).press("Enter");
    await expect.poll(() => rowTitles(openSection(page))).toEqual(["First task", "Third task", "Second task"]);
    await row(page, "Second task").getByRole("img", { name: t.taskOrderPosition(3) }).dragTo(row(page, "First task"));
    await expect.poll(() => rowTitles(openSection(page))).toEqual(["Second task", "First task", "Third task"]);
    await page.reload();
    await expect.poll(() => rowTitles(openSection(page))).toEqual(["Second task", "First task", "Third task"]);
    const task = row(page, "Second task");
    await task.getByRole("checkbox", { name: t.markDone }).click();
    await expect(row(page, "First task").getByRole("img", { name: t.taskOrderPosition(1) })).toBeVisible();
    await expect.poll(async () => (await listTasks(request)).find((item) => item.title === "Second task")?.done).toBe(true);
    const saved = await listTasks(request);
    const result = await (await request.get(`/api/tasks/order?day=${TODAY}`)).json();
    expect(result.order.taskIds).toEqual(["First task", "Third task"].map((title) => saved.find((item) => item.title === title)?.id));
  });

  test(`approves the Assistant's order as one journal decision in ${locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale, startView: "today", aiProvider: "openai", aiModel: "test-agent" });
    await request.post("/api/tasks", { data: [
      { title: "First task", plannedFor: TODAY }, { title: "Second task", plannedFor: TODAY },
    ] });
    const [first, second] = await listTasks(request);
    const plan = { summary: "Two tasks can be reordered.", proposals: [{
      kind: "order_day", reason: "Do the smaller task first.", items: [
        { taskId: second.id, reason: "Quick to finish." }, { taskId: first.id, reason: "Requires focus." },
      ],
    }] };
    await request.put(fixtureUrl, { data: { plan } });
    await page.goto("/agent");
    await page.getByRole("button", { name: t.agentReviewTasks }).click();
    const proposal = pending(page, locale).getByRole("article", { name: TODAY, exact: true });
    await expect(proposal).toContainText("Quick to finish.");
    expect((await (await request.get(`/api/tasks/order?day=${TODAY}`)).json()).order.taskIds).toEqual([first.id, second.id]);
    await proposal.getByRole("button", { name: t.agentAccept }).click();
    await expect(pending(page, locale).getByRole("article")).toHaveCount(0);
    await page.goto("/");
    await expect.poll(() => rowTitles(openSection(page))).toEqual(["Second task", "First task"]);
  });
}
