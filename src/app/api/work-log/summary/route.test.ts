import { AiError } from "@/features/ai/schema";
import { beforeEach, expect, it, vi } from "vitest";
const { summarize, createGenerator, generate } = vi.hoisted(() => ({ summarize: vi.fn(), createGenerator: vi.fn(), generate: vi.fn() }));
vi.mock("@/features/ai/server/configuration", () => ({ aiPublicConfiguration: () => ({ available: { openrouter: true } }) }));
vi.mock("@/features/ai/server/generate", () => ({ createGenerator }));
vi.mock("@/features/tasks/server/repository", () => ({ listTasks: async () => [] }));
vi.mock("@/features/projects/server/repository", () => ({ listProjects: async () => [] }));
vi.mock("@/features/settings/server/repository", () => ({ getSettings: async () => ({ locale: "en", aiProvider: "openrouter", aiModel: "custom/model" }) }));
vi.mock("@/features/work-log/server/summary", async (original) => ({
  ...await original<typeof import("@/features/work-log/server/summary")>(), summarizeWorkLog: summarize,
}));
import { POST } from "./route";

beforeEach(() => { vi.clearAllMocks(); createGenerator.mockReturnValue(generate); });

it("returns a stable failure when the SDK rejects structured output, without exposing provider details", async () => {
  summarize.mockRejectedValue(new AiError("ai_failed"));
  const response = await POST(new Request("http://localhost/api/work-log/summary", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ day: "2026-11-17", timeZone: "America/Sao_Paulo" }),
  }));
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ error: "work_log_ai_failed" });
});

it("uses the saved provider/model through the same shared generator as capture", async () => {
  summarize.mockResolvedValue("Reviewed the report.");
  const response = await POST(new Request("http://localhost/api/work-log/summary", {
    method: "POST", body: JSON.stringify({ day: "2026-11-17", timeZone: "America/Sao_Paulo" }),
  }));
  expect(await response.json()).toEqual({ summary: "Reviewed the report." });
  expect(createGenerator).toHaveBeenCalledWith({ locale: "en", aiProvider: "openrouter", aiModel: "custom/model" });
  expect(summarize).toHaveBeenCalledWith(generate, [], [], { day: "2026-11-17", timeZone: "America/Sao_Paulo" }, "en");
});

it.each(["ai_auth", "ai_busy", "ai_disabled", "ai_refused"] as const)("maps %s to a safe API response", async (code) => {
  summarize.mockRejectedValue(new AiError(code));
  const response = await POST(new Request("http://localhost/api/work-log/summary", {
    method: "POST", body: JSON.stringify({ day: "2026-11-17", timeZone: "America/Sao_Paulo" }),
  }));
  expect(response.status).toBe(code === "ai_busy" ? 429 : code === "ai_disabled" ? 503 : 502);
  expect(await response.json()).toEqual({ error: code === "ai_refused" ? "work_log_ai_failed" : code });
});
