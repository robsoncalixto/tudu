import { dictionaries } from "../src/i18n";
import { proposalSchema } from "../src/features/agent/schema";
import { fixture, fixtureUrl, taskDraft, createTask, pending } from "./agent-support";
import { expect, listProjects, listTasks, saveSettings, seed, seedProjects, sidebar, test, TODAY } from "./support";

for (const locale of ["en", "pt-BR"] as const) {
  const t = dictionaries[locale];
  test(`reviews, edits, accepts and rejects task/project proposals with durable history in ${locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale, aiProvider: "openai", aiModel: "test-agent" });
    const [existing] = await seedProjects(request, ["Existing client"]);
    await seed(request, [{ title: "Existing task" }]);
    await fixture(request, [
      { kind: "create_project", name: "New client", reason: "Requested project" },
      { ...createTask(), task: { ...taskDraft, projectId: existing.id } }, createTask("Leave out"),
    ]);
    await page.goto("/"); await sidebar(page).getByRole("link", { name: t.agent, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(locale === "en" ? "Assistant" : "Assistente");
    await page.getByRole("textbox", { name: t.agentPrompt, exact: true }).fill("Organize the day; all changes need my review.");
    await page.getByRole("button", { name: t.agentPropose, exact: true }).click();
    await expect(pending(page, locale).getByRole("article")).toHaveCount(3);
    expect((await listTasks(request)).map((task) => task.title)).toEqual(["Existing task"]);
    expect(await listProjects(request)).toEqual([existing]);
    const project = pending(page, locale).getByRole("article", { name: "New client", exact: true });
    await project.getByRole("textbox", { name: t.projectName, exact: true }).fill("Approved client");
    await project.getByRole("button", { name: t.agentAccept, exact: true }).click();
    await expect(project).toHaveCount(0);
    const approvedProject = (await listProjects(request)).find((project) => project.name === "Approved client")!;
    const proposal = pending(page, locale).getByRole("article", { name: "Suggested report", exact: true });
    await proposal.getByRole("textbox", { name: t.agentTaskTitle, exact: true }).fill("Reviewed report");
    await proposal.getByRole("textbox", { name: t.agentTaskTitle, exact: true }).press("Enter");
    await proposal.getByRole("textbox", { name: t.agentNotes, exact: true }).fill("Human note");
    expect((await listTasks(request)).map((task) => task.title)).toEqual(["Existing task"]);
    await proposal.getByRole("combobox", { name: t.priority, exact: true }).selectOption("low");
    await proposal.getByLabel(t.setDate, { exact: true }).fill("2026-11-19");
    await proposal.getByRole("combobox", { name: t.project, exact: true }).selectOption(approvedProject.id);
    await proposal.getByRole("textbox", { name: t.tags, exact: true }).pressSequentially("work, client");
    await expect(proposal.getByRole("textbox", { name: t.tags, exact: true })).toHaveValue("work, client");
    await proposal.getByRole("textbox", { name: t.agentStep(1), exact: true }).fill("Prepare draft");
    await proposal.getByRole("button", { name: t.deleteStep("Review"), exact: true }).click();
    await proposal.getByRole("button", { name: t.addStep, exact: true }).click();
    await proposal.getByRole("textbox", { name: t.agentStep(2), exact: true }).fill("Check date");
    await proposal.getByRole("button", { name: t.agentAccept, exact: true }).focus();
    await proposal.getByRole("button", { name: t.agentAccept, exact: true }).press("Enter");
    const saved = page.getByRole("article", { name: "Reviewed report", exact: true });
    await expect(saved).toContainText(t.agentStatuses.accepted); await expect(saved).toBeFocused();
    expect((await listTasks(request))[1]).toMatchObject({ title: "Reviewed report", notes: "Human note", priority: "low", due: "2026-11-19", plannedFor: TODAY,
      projectId: approvedProject.id, tags: ["work", "client"], steps: [{ title: "Prepare draft", done: false }, { title: "Check date", done: false }] });
    await saved.getByText(t.agentOriginal, { exact: true }).click(); await expect(saved.getByText("Suggested report", { exact: true })).toBeVisible();
    await pending(page, locale).getByRole("article", { name: "Leave out", exact: true }).getByRole("button", { name: t.agentReject, exact: true }).click();
    await expect(page.getByText(t.agentNoPending, { exact: true })).toBeVisible();
    expect(await listTasks(request)).toHaveLength(2);
    const history = proposalSchema.array().parse((await (await request.get("/api/agent/proposals")).json()).proposals);
    expect(history.find((proposal) => proposal.action.kind === "create_task" && proposal.action.task.title === "Suggested report"))
      .toMatchObject({ status: "accepted", action: { task: { title: "Suggested report", projectId: existing.id } }, approved: { task: { title: "Reviewed report", projectId: approvedProject.id } } });
    expect(history.find((proposal) => proposal.action.kind === "create_task" && proposal.action.task.title === "Leave out")?.status).toBe("rejected");
    await page.reload(); await expect(page.getByRole("article")).toHaveCount(3); await expect(saved).toContainText(t.agentStatuses.accepted);
    const requests = (await (await request.get(fixtureUrl)).json()).requests;
    expect(requests).toHaveLength(1); expect(requests[0].model).toBe("test-agent");
    expect(JSON.parse(requests[0].input).context.tasks[0].title).toBe("Existing task");
  });


}
