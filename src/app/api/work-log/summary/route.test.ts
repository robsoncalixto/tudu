import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, expect, it, vi } from "vitest";
const { summarize } = vi.hoisted(() => ({ summarize: vi.fn() }));
vi.mock("@/features/capture/server/capture", () => ({ aiEnabled: () => true }));
vi.mock("@/features/tasks/server/repository", () => ({ listTasks: async () => [] }));
vi.mock("@/features/projects/server/repository", () => ({ listProjects: async () => [] }));
vi.mock("@/features/settings/server/repository", () => ({ getSettings: async () => ({ locale: "en" }) }));
vi.mock("@/features/work-log/server/summary", async (original) => ({
  ...await original<typeof import("@/features/work-log/server/summary")>(), summarizeWorkLog: summarize,
}));
import { POST } from "./route";

beforeEach(() => vi.clearAllMocks());

it("returns a stable failure when the SDK rejects structured output, without exposing provider details", async () => {
  summarize.mockRejectedValue(new Anthropic.AnthropicError("Private model response failed validation"));
  const response = await POST(new Request("http://localhost/api/work-log/summary", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ day: "2026-11-17", timeZone: "America/Sao_Paulo" }),
  }));
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ error: "work_log_ai_failed" });
});
