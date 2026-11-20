import { dictionaries } from "../src/i18n";
import { fixtureUrl, pending } from "./agent-support";
import { expect, listTasks, row, saveSettings, seed, sidebar, test } from "./support";

for (const locale of ["en", "pt-BR"] as const) {
  const t = dictionaries[locale];
  test(`runs the scheduled review on the server while the browser is closed in ${locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale, aiProvider: "openai", aiModel: "test-agent" });
    const [task] = await seed(request, [{ title: "Scheduled review target", due: "2026-11-01" }]);
    const plan = { summary: locale === "en" ? "An item needs attention." : "Um item precisa de atenção.", proposals: [
      { kind: "set_priority", taskId: task.id, priority: "high", reason: locale === "en" ? "Overdue." : "Atrasada." },
    ] };
    expect((await request.put(fixtureUrl, { data: { plan } })).ok()).toBe(true);
    await page.goto("/settings");
    const enabled = page.getByRole("checkbox", { name: t.automaticReviewEnabled, exact: true });
    await expect(enabled).not.toBeChecked();
    await enabled.check();
    await page.getByLabel(t.automaticReviewTime("America/Sao_Paulo")).fill("00:00");
    await page.getByRole("button", { name: t.saveSettings, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(t.settingsSaved);
    await page.goto("about:blank");
    try {
      await expect.poll(async () => {
        const response = await request.get("/api/agent/proposals");
        return (await response.json()).automaticReview?.outcome;
      }, { timeout: 18_000 }).toBe("succeeded");
      await page.goto("/");
      await expect(row(page, task.title)).toBeVisible();
      const assistant = sidebar(page).getByRole("link", { name: t.agent, exact: true });
      await expect(assistant).toHaveAttribute("aria-description", t.pendingAgentCount(1));
      await assistant.click();
      await expect(page.getByText(t.automaticReviewOutcomes.succeeded, { exact: false })).toBeVisible();
      await expect(pending(page, locale).getByRole("article", { name: task.title })).toBeVisible();
      expect((await listTasks(request))[0].priority).toBe("medium");
      const { requests } = await (await request.get(fixtureUrl)).json();
      expect(requests).toHaveLength(1);
    } finally {
      await saveSettings(request, { automaticReview: { enabled: false, time: "09:00", timeZone: "UTC", enabledAt: null } });
    }
  });
}

test("records an unchanged schedule slot without calling the model again", async ({ page, request }) => {
  await saveSettings(request, { aiProvider: "openai", aiModel: "test-agent" });
  await seed(request, [{ title: "Already reviewed", due: "2026-11-01" }]);
  const result = await request.put(fixtureUrl, { data: { plan: { summary: "Already reviewed.", proposals: [] } } });
  expect(result.ok()).toBe(true);
  const manual = await request.post("/api/agent/proposals", { data: { review: true, text: "", today: "2026-11-17" } });
  expect(manual.status()).toBe(201);
  await saveSettings(request, { automaticReview: { enabled: true, time: "00:00", timeZone: "UTC", enabledAt: null } });
  try {
    await expect.poll(async () => {
      const response = await request.get("/api/agent/proposals");
      return (await response.json()).automaticReview?.skipReason;
    }, { timeout: 18_000 }).toBe("unchanged");
    await page.goto("/agent");
    await expect(page.getByText(dictionaries.en.automaticReviewSkipReasons.unchanged, { exact: false })).toBeVisible();
    expect((await (await request.get(fixtureUrl)).json()).requests).toHaveLength(1);
  } finally {
    await saveSettings(request, { automaticReview: { enabled: false, time: "09:00", timeZone: "UTC", enabledAt: null } });
  }
});
