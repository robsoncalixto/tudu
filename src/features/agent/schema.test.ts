import { describe, expect, it } from "vitest";
import { proposalActionSchema, proposalDecisionSchema, proposalRequestSchema, proposalSchema, proposedTaskSchema } from "./schema";

const task = proposedTaskSchema.parse({ title: "Review", due: null, repeat: null, plannedFor: null });
const pending = {
  id: "00000000-0000-4000-8000-000000000001", createdAt: "2026-11-17T12:00:00Z",
  source: { note: "Review", today: "2026-11-17", provider: "openai", model: "test" },
  action: { kind: "create_task", task }, reason: "Requested", taskBefore: null, projectBefore: null,
  status: "pending", approved: null, result: null, decidedAt: null, appliedAt: null,
};
describe("agent contracts", () => {
  it("rejects year zero in new requests while preserving previously saved sources", () => {
    const today = "0000-01-01";
    expect(proposalRequestSchema.safeParse({ text: "Plan a task", today }).success).toBe(false);
    expect(proposalDecisionSchema.safeParse({ decision: "accept", action: pending.action, today }).success).toBe(false);
    expect(proposalSchema.parse({ ...pending, source: { ...pending.source, today } }).source.today).toBe(today);
  });
  it("preserves minute estimates as hours in legacy proposal baselines and results", () => {
    const before = { title: "Existing task", id: "task", done: false, createdAt: "2026-11-01T12:00:00.000Z", completedAt: null, estimateMinutes: 90 };
    const action = { kind: "update_task", taskId: "task", patch: { priority: "high" } };
    const proposal = { ...pending, action, taskBefore: before };
    expect(proposalSchema.parse(proposal).taskBefore).toMatchObject({ estimateHours: 1.5, realTimeHours: null });
    const accepted = proposalSchema.parse({ ...proposal, status: "accepted", approved: action,
      decidedAt: pending.createdAt, appliedAt: pending.createdAt, result: { kind: "task", task: { ...before, priority: "high" } } });
    expect(accepted.result).toMatchObject({ kind: "task", task: { estimateHours: 1.5, realTimeHours: null } });
    expect(accepted.taskBefore).not.toHaveProperty("estimateMinutes");
    expect(proposalSchema.safeParse({ ...proposal, taskBefore: { ...before, estimateMinutes: -1 } }).success).toBe(false);
  });

  it("requires an explicit decision and rejects hidden task fields or unsupported operations", () => {
    expect(proposalDecisionSchema.parse({ decision: "accept", action: pending.action })).toMatchObject({ decision: "accept" });
    for (const input of [{ action: pending.action }, { decision: "accept" }, { decision: "reject", action: pending.action }]) {
      expect(proposalDecisionSchema.safeParse(input).success).toBe(false);
    }
    for (const action of [
      { kind: "delete_task", taskId: "task" }, { kind: "update_task", taskId: "task", patch: { done: true } },
      { kind: "update_task", taskId: "task", patch: { nextOccurrenceId: "forged" } },
      { kind: "update_task", taskId: "task", patch: { links: ["https://example.org/private"] } },
      { ...pending.action, task: { ...task, realTimeHours: 0.75 } },
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
