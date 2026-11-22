import type { APIRequestContext, Page } from "@playwright/test";
import { dictionaries } from "../src/i18n";
import { proposalSchema, type Proposal } from "../src/features/agent/schema";
import { expect, saveSettings, TODAY } from "./support";

export const fixtureUrl = `http://127.0.0.1:${process.env.TUDU_AI_TEST_PORT ?? 3120}/fixture`;
export const taskDraft = { title: "Suggested report", notes: "Original note", priority: "high", due: "2026-11-18", tags: [], steps: ["Draft", "Review"], projectId: null, plannedFor: TODAY, estimateHours: null, partOfDay: null };
export const createTask = (title = taskDraft.title) => ({ kind: "create_task", task: { ...taskDraft, title }, reason: "Requested work" });
export const pending = (page: Page, locale: "en" | "pt-BR") => page.getByRole("region", { name: new RegExp(`^${dictionaries[locale].agentPending}`) });
export async function fixture(request: APIRequestContext, proposals: unknown[], status = 200) {
  expect((await request.put(fixtureUrl, { data: { plan: { proposals }, status } })).ok()).toBe(true);
}
export async function seedPlan(request: APIRequestContext, proposals: unknown[], locale: "en" | "pt-BR" = "en"): Promise<Proposal[]> {
  await saveSettings(request, { locale, aiProvider: "openai", aiModel: "test-agent" });
  await fixture(request, proposals);
  const response = await request.post("/api/agent/proposals", { data: { text: "Organize the work", today: TODAY } });
  expect(response.status()).toBe(201);
  return proposalSchema.array().parse((await response.json()).proposals);
}
