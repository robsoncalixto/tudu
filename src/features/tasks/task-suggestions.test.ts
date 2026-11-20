import { describe, expect, it } from "vitest";
import { proposalSchema } from "@/features/agent/schema";
import { suggestionsByTask, suggestedSteps } from "./task-suggestions";

const day = "2026-11-17";
const existing = { id: "saved", title: "Saved subtask", done: false };
const proposed = { id: "suggested", title: "Suggested subtask", done: false };
const proposal = proposalSchema.parse({
  id: "00000000-0000-4000-8000-000000000001", createdAt: `${day}T12:00:00Z`,
  action: { kind: "update_task", taskId: "task", patch: { steps: [existing, proposed] } },
  reason: "Additional step", taskBefore: { id: "task", title: "Task", createdAt: `${day}T12:00:00Z`, completedAt: null, done: false, steps: [existing] },
  projectBefore: null, source: { note: "Task steps", today: day, provider: "openai", model: "test" },
  status: "pending", approved: null, result: null, appliedAt: null, decidedAt: null,
});
describe("in-task proposals", () => {
  it("groups only pending task suggestions and excludes existing steps from the suggestion preview", () => {
    const index = suggestionsByTask([proposal, { ...proposal, status: "rejected" }], true);
    expect(index.get("task")).toHaveLength(1);
    expect(suggestedSteps(index.get("task")![0])).toEqual([proposed]);
    expect(suggestionsByTask([proposal], false).size).toBe(0);
  });
});
