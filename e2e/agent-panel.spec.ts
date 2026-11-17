import { dictionaries } from "../src/i18n";
import { fixture, createTask, pending } from "./agent-support";
import { expect, listProjects, listTasks, saveSettings, test, TODAY } from "./support";

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
