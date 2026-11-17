import { describe, expect, it } from "vitest";
import { proposalActionSchema, proposalDecisionSchema, proposalSchema, proposedTaskSchema } from "./schema";

const task = proposedTaskSchema.parse({ title: "Review", due: null, repeat: null, plannedFor: null });
const pending = {
  id: "00000000-0000-4000-8000-000000000001", createdAt: "2026-11-17T12:00:00Z",
  source: { note: "Review", today: "2026-11-17", provider: "openai", model: "test" },
  action: { kind: "create_task", task }, reason: "Requested", taskBefore: null, projectBefore: null,
  status: "pending", approved: null, result: null, decidedAt: null, appliedAt: null,
};
describe("agent contracts", () => {
  it("requires an explicit decision and rejects hidden task fields or unsupported operations", () => {
    expect(proposalDecisionSchema.parse({ decision: "accept", action: pending.action })).toMatchObject({ decision: "accept" });
    for (const input of [{ action: pending.action }, { decision: "accept" }, { decision: "reject", action: pending.action }]) {
      expect(proposalDecisionSchema.safeParse(input).success).toBe(false);
    }
    for (const action of [
      { kind: "delete_task", taskId: "task" }, { kind: "update_task", taskId: "task", patch: { done: true } },
      { kind: "update_task", taskId: "task", patch: { nextOccurrenceId: "forged" } },
      { kind: "update_task", taskId: "task", patch: {} },
      { ...pending.action, task: { ...task, id: "injected" } },
      { ...pending.action, task: { ...task, due: "2026-02-30" } },
    ]) expect(proposalActionSchema.safeParse(action).success).toBe(false);
  });
  it("requires consistent approval, result and timing fields in the durable log", () => {
    expect(proposalSchema.parse(pending).status).toBe("pending");
    for (const patch of [
      { status: "accepted" }, { status: "applying" }, { approved: pending.action }, { appliedAt: pending.createdAt },
      { status: "rejected", decidedAt: pending.createdAt, approved: pending.action },
      { action: { kind: "update_task", taskId: "missing", patch: { priority: "high" } } },
    ]) expect(proposalSchema.safeParse({ ...pending, ...patch }).success).toBe(false);
  });
});
