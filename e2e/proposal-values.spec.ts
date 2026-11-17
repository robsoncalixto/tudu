import { dictionaries } from "../src/i18n";
import { seedPlan, taskDraft } from "./agent-support";
import { expect, seedProjects, test } from "./support";

for (const locale of ["en", "pt-BR"] as const) {
  const t = dictionaries[locale];
  test(`shows original and approved values as literal content with exact dates in ${locale}`, async ({ page, request }) => {
    const [project] = await seedProjects(request, ["Acme"]);
    const [proposal] = await seedPlan(request, [{ kind: "create_task", task: { ...taskDraft,
      title: "Literal <b>review</b>", notes: "Do not treat **this** as markup", projectId: project.id,
    }, reason: "Requested review" }], locale);
    if (proposal.action.kind !== "create_task") throw new Error("Expected a task proposal");
    const response = await request.post(`/api/agent/proposals/${proposal.id}`, { data: { decision: "accept", action: {
      ...proposal.action, task: { ...proposal.action.task, title: "Saved title", priority: "low", due: "2026-11-20" },
    } } });
    expect(response.status()).toBe(200);
    await page.goto("/agent");
    const card = page.getByRole("article", { name: "Saved title", exact: true });
    const approved = card.getByRole("region", { name: t.agentApproved, exact: true });
    await expect(approved.getByText(t.low, { exact: true })).toBeVisible();
    await expect(approved.getByText("2026-11-20", { exact: true })).toBeVisible();
    await expect(approved.getByText("Acme", { exact: true })).toBeVisible();
    await expect(approved.getByText("Do not treat **this** as markup", { exact: true })).toBeVisible();
    await expect(approved.getByRole("listitem").first()).toHaveText(locale === "en" ? "Draft · Open" : "Draft · Aberta");
    await card.getByText(t.agentOriginal, { exact: true }).click();
    await expect(card.getByText("Literal <b>review</b>", { exact: true })).toBeVisible();
    expect(await card.locator("b").count()).toBe(0);
    await card.getByText(t.agentSource, { exact: true }).click();
    await expect(card.getByText("Organize the work", { exact: true })).toBeVisible();
  });
}
