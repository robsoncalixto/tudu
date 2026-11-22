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
    await expect(row(page, "Third task").getByRole("button", { name: t.moveTaskUp })).toBeFocused();
    await row(page, "Second task").getByRole("img", { name: t.taskOrderPosition(3) }).dragTo(row(page, "First task"));
    await expect.poll(() => rowTitles(openSection(page))).toEqual(["Second task", "First task", "Third task"]);
    await page.reload();
    await expect.poll(() => rowTitles(openSection(page))).toEqual(["Second task", "First task", "Third task"]);
    const task = row(page, "Second task");
    await task.getByRole("checkbox", { name: t.markDone }).click();
    await expect(row(page, "First task").getByRole("img", { name: t.taskOrderPosition(1) })).toBeVisible();
    await page.getByRole("status").getByRole("button", { name: t.dismiss }).click();
    await expect.poll(async () => (await listTasks(request)).find((item) => item.title === "Second task")?.done).toBe(true);
    const saved = await listTasks(request);
    const result = await (await request.get(`/api/tasks/order?day=${TODAY}`)).json();
    expect(result.order.taskIds).toEqual(["First task", "Third task"].map((title) => saved.find((item) => item.title === title)?.id));
  });

  test.describe(`phone order in ${locale}`, () => {
    test.use({ viewport: { width: 320, height: 812 }, hasTouch: true });

    test("offers touch targets for moving a task without widening the board", async ({ page, request }) => {
      await saveSettings(request, { locale, startView: "today" });
      await request.post("/api/tasks", { data: [
        { title: "First task", plannedFor: TODAY }, { title: "Second task", plannedFor: TODAY },
      ] });
      await page.goto("/");
      const move = row(page, "Second task").getByRole("button", { name: t.moveTaskUp });
      const bounds = await move.boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
      expect(bounds?.width).toBeGreaterThanOrEqual(44);
      await move.tap();
      await expect.poll(() => rowTitles(openSection(page))).toEqual(["Second task", "First task"]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    });
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

test("can reorder Today and still undo a pending deletion", async ({ page, request }) => {
  const t = dictionaries.en;
  await saveSettings(request, { startView: "today" });
  await request.post("/api/tasks", { data: ["First", "Second", "Third"].map((title) => ({ title, plannedFor: TODAY })) });
  const [first, second, third] = await listTasks(request);
  await page.goto("/");
  await row(openSection(page), "First").focus();
  await page.keyboard.press("Delete");
  const status = page.getByRole("status");
  const undo = status.getByRole("button", { name: t.undo });
  await expect(undo).toBeVisible();
  await expect(row(openSection(page), "First")).toHaveCount(0);
  await row(page, "Third").getByRole("button", { name: t.moveTaskUp }).click();
  await expect.poll(() => rowTitles(openSection(page))).toEqual(["Third", "Second"]);
  const read = async () => (await (await request.get(`/api/tasks/order?day=${TODAY}`)).json()).order.taskIds;
  expect(await read()).toEqual([first.id, third.id, second.id]);
  await undo.click();
  await expect.poll(() => rowTitles(openSection(page))).toEqual(["First", "Third", "Second"]);
  await page.reload();
  await expect.poll(() => rowTitles(openSection(page))).toEqual(["First", "Third", "Second"]);
});

test("refreshes a stale board order before retrying a move", async ({ page, request }) => {
  await saveSettings(request, { startView: "today" });
  await request.post("/api/tasks", { data: ["First", "Second", "Third"].map((title) => ({ title, plannedFor: TODAY })) });
  const [first, second, third] = await listTasks(request);
  await page.goto("/");
  await expect(row(page, "Third")).toBeVisible();
  const external = await request.post("/api/tasks/order", { data: { day: TODAY, taskIds: [third.id, first.id, second.id] } });
  expect(external.ok()).toBe(true);
  await row(page, "Third").getByRole("button", { name: dictionaries.en.moveTaskUp }).click();
  await expect.poll(() => rowTitles(openSection(page))).toEqual(["Third", "First", "Second"]);
  await row(page, "First").getByRole("button", { name: dictionaries.en.moveTaskUp }).click();
  await expect.poll(() => rowTitles(openSection(page))).toEqual(["First", "Third", "Second"]);
});
