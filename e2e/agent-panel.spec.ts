import { dictionaries } from "../src/i18n";
import { fixture, fixtureUrl, createTask, pending } from "./agent-support";
import { expect, listProjects, listTasks, saveSettings, seed, test, TODAY } from "./support";

for (const locale of ["en", "pt-BR"] as const) {
  const t = dictionaries[locale];
  test(`provider and save failures keep drafts and recover in ${locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale, aiProvider: "openai", aiModel: "test-agent" }); await fixture(request, [], 500);
    await page.goto("/agent"); await page.getByRole("textbox", { name: t.agentPrompt, exact: true }).fill("Keep this note");
    await page.getByRole("button", { name: t.agentPropose, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(t.errors.agent_failed);
    await expect(page.getByRole("textbox", { name: t.agentPrompt, exact: true })).toHaveValue("Keep this note");
    expect(await listTasks(request)).toEqual([]);
    await fixture(request, [{ kind: "set_priority", taskId: "invented", priority: "high", reason: "Invalid target" }]);
    await page.getByRole("button", { name: t.agentPropose, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(t.errors.agent_invalid_proposal);
    expect((await (await request.get("/api/agent/proposals")).json()).proposals).toEqual([]);
    await fixture(request, [createTask()]); await page.getByRole("button", { name: t.agentPropose, exact: true }).click();
    const proposal = pending(page, locale).getByRole("article", { name: "Suggested report", exact: true });
    await proposal.getByRole("textbox", { name: t.agentTaskTitle, exact: true }).fill("Draft survives");
    await page.route("**/api/agent/proposals/*", (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    await proposal.getByRole("button", { name: t.agentAccept, exact: true }).click();
    await expect(proposal.getByRole("alert")).toHaveText(t.errors.generic);
    await expect(proposal.getByRole("textbox", { name: t.agentTaskTitle, exact: true })).toHaveValue("Draft survives");
    expect(await listTasks(request)).toEqual([]);
    await page.unroute("**/api/agent/proposals/*"); await proposal.getByRole("button", { name: t.agentAccept, exact: true }).click();
    await expect(page.getByRole("article", { name: "Draft survives", exact: true })).toContainText(t.agentStatuses.accepted);
    expect((await listTasks(request)).map((task) => task.title)).toEqual(["Draft survives"]);
  });

  test(`load recovery, empty suggestions, no-key controls and phone layout in ${locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale }); await page.setViewportSize({ width: 320, height: 900 });
    await page.route("**/api/agent/proposals", (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    await page.goto("/agent"); await expect(page.getByRole("status")).toHaveText(t.errors.generic);
    await page.unroute("**/api/agent/proposals"); await page.getByRole("button", { name: t.agentRefresh, exact: true }).click();
    await expect(page.getByText(t.agentNoPending, { exact: true })).toBeVisible();
    await expect(page.getByText(t.aiOff, { exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: t.agentPrompt, exact: true }).fill("Nothing to change");
    await expect(page.getByRole("button", { name: t.agentPropose, exact: true })).toBeDisabled();
    expect((await request.post("/api/agent/proposals", { data: { text: "Note", today: TODAY } })).status()).toBe(503);
    await saveSettings(request, { aiProvider: "openai" }); await fixture(request, []);
    await page.getByRole("button", { name: t.agentRefresh, exact: true }).click();
    await page.getByRole("button", { name: t.agentPropose, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(t.agentNoSuggestions);
    await page.getByRole("textbox", { name: t.agentPrompt, exact: true }).focus();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(await listTasks(request)).toEqual([]); expect(await listProjects(request)).toEqual([]);
  });
}

for (const locale of ["en", "pt-BR"] as const) {
  const t = dictionaries[locale];
  test(`reviews without a note and keeps duplicate suggestions pending only once in ${locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale, aiProvider: "openai", aiModel: "test-agent" });
    const [overdue, matching] = await seed(request, [{ title: "Overdue invoice", due: "2026-11-16" }, { title: "Send invoice again" }]);
    const summary = locale === "en" ? "One invoice is overdue." : "Uma fatura está atrasada.";
    const reason = locale === "en" ? "The invoice needs attention." : "A fatura precisa de atenção.";
    const plan = { summary, proposals: [
      { kind: "set_priority", taskId: overdue.id, priority: "high", reason },
      { kind: "flag_duplicate", taskId: matching.id, otherTaskId: overdue.id, reason },
    ] };
    const before = await listTasks(request);
    expect((await request.put(fixtureUrl, { data: { plan } })).ok()).toBe(true);
    await page.goto("/agent");
    const review = page.getByRole("button", { name: t.agentReviewTasks, exact: true });
    const note = page.getByRole("textbox", { name: t.agentPrompt, exact: true });
    await expect(note).toHaveValue("");
    await review.click();
    await expect(page.getByRole("region", { name: t.agentReviewSummary })).toContainText(summary);
    await expect(pending(page, locale).getByRole("article")).toHaveCount(2);
    await expect(pending(page, locale).getByRole("article", { name: matching.title })).toContainText(t.agentPossibleDuplicate(overdue.title));
    expect(await listTasks(request)).toEqual(before);
    await note.fill("Focus on invoices");
    await review.click();
    await expect(page.getByRole("status")).toHaveText(t.agentNoSuggestions);
    await expect(pending(page, locale).getByRole("article")).toHaveCount(2);
    const { requests } = await (await request.get(fixtureUrl)).json();
    expect(JSON.stringify(requests[1])).toContain("Focus on invoices");
    await pending(page, locale).getByRole("article", { name: matching.title }).getByRole("button", { name: t.agentAccept }).click();
    await expect(pending(page, locale).getByRole("article")).toHaveCount(1);
    expect(await listTasks(request)).toEqual(before);
  });
}
