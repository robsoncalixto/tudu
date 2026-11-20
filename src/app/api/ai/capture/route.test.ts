import { beforeEach, describe, expect, it, vi } from "vitest";
import { AI_PROVIDERS, AiError } from "@/features/ai/schema";
import { DEFAULT_SETTINGS } from "@/features/settings/schema";
import { taskSchema } from "@/features/tasks/schema";

const { capture, createGenerator, generate, getSettings, addTasks } = vi.hoisted(() => ({
  capture: vi.fn(), createGenerator: vi.fn(), generate: vi.fn(), getSettings: vi.fn(), addTasks: vi.fn(),
}));
vi.mock("@/features/capture/server/capture", () => ({ captureTasks: capture }));
vi.mock("@/features/ai/server/configuration", () => ({ aiPublicConfiguration: () => ({ available: { anthropic: true, openai: true, openrouter: true } }) }));
vi.mock("@/features/ai/server/generate", () => ({ createGenerator }));
vi.mock("@/features/settings/server/repository", () => ({ getSettings }));
vi.mock("@/features/tasks/server/repository", () => ({ addTasks }));
vi.mock("@/features/projects/server/repository", async (original) => ({
  ...await original<typeof import("@/features/projects/server/repository")>(),
  listProjects: async () => [], withValidProjectIds: async <T>(_ids: unknown, operation: () => Promise<T>) => operation(),
}));
import { POST } from "./route";

const task = taskSchema.parse({ id: "created", title: "Report", createdAt: "2026-11-17T12:00:00Z", done: false, completedAt: null });
const request = (text = "A note") => new Request("http://localhost/api/ai/capture", {
  method: "POST", body: JSON.stringify({ text, today: "2026-11-17", aiProvider: "untrusted", aiModel: "injected-model", apiKey: "ignored-client-key" }),
});
beforeEach(() => {
  vi.clearAllMocks(); createGenerator.mockReturnValue(generate);
  getSettings.mockResolvedValue(DEFAULT_SETTINGS); capture.mockResolvedValue([task]); addTasks.mockResolvedValue([task]);
});
describe("capture provider coordination", () => {
  it.each(AI_PROVIDERS)("uses the saved %s provider/model and priority, never client credentials", async (aiProvider) => {
    const settings = { ...DEFAULT_SETTINGS, aiProvider, aiModel: "selected-model", defaultPriority: "high" };
    getSettings.mockResolvedValue(settings);
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ tasks: [task] });
    expect(createGenerator).toHaveBeenCalledWith(settings);
    expect(capture).toHaveBeenCalledWith(generate, "A note", "2026-11-17", [], "high", undefined);
    expect(addTasks).toHaveBeenCalledWith([task]);
  });
  it.each(["ai_auth", "ai_busy", "ai_disabled", "ai_failed", "ai_refused"] as const)("maps %s without saving any task", async (code) => {
    capture.mockRejectedValue(new AiError(code));
    const response = await POST(request());
    expect(response.status).toBe(code === "ai_busy" ? 429 : code === "ai_disabled" ? 503 : code === "ai_refused" ? 422 : 502);
    expect(await response.json()).toEqual({ error: code === "ai_refused" ? "no_tasks" : code });
    expect(addTasks).not.toHaveBeenCalled();
  });
  it("does not call a provider for invalid input and does not save empty captures", async () => {
    expect((await POST(request(""))).status).toBe(400);
    expect(capture).not.toHaveBeenCalled();
    capture.mockResolvedValue([]);
    const response = await POST(request());
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "no_tasks" });
    expect(addTasks).not.toHaveBeenCalled();
  });
});
