import { expect, it } from "vitest";
import { taskSchema } from "@/features/tasks/schema";
import { proposalSchema, proposedTaskSchema } from "./schema";
import { splitProposals } from "./selectors";

it("keeps unresolved work visible and orders history by decision time without changing the source", () => {
  const action = { kind: "create_task", task: proposedTaskSchema.parse({ title: "Review", due: null, repeat: null, plannedFor: null }) };
  const base = { id: "00000000-0000-4000-8000-000000000001", createdAt: "2026-11-01T12:00:00Z",
    source: { note: "Review", today: "2026-11-17", provider: "openai", model: "test" },
    action, reason: "Requested", taskBefore: null, projectBefore: null, approved: null, result: null, decidedAt: null, appliedAt: null };
  const task = taskSchema.parse({ id: base.id, title: "Review", done: false, createdAt: base.createdAt, completedAt: null });
  const accepted = proposalSchema.parse({ ...base, status: "accepted", approved: action, result: { kind: "task", task }, decidedAt: "2026-11-17T12:00:00Z", appliedAt: "2026-11-17T12:00:01Z" });
  const rejected = proposalSchema.parse({ ...base, id: "00000000-0000-4000-8000-000000000002", status: "rejected", createdAt: "2026-11-16T12:00:00Z", decidedAt: "2026-11-16T12:01:00Z" });
  const pending = proposalSchema.parse({ ...base, id: "00000000-0000-4000-8000-000000000003", status: "pending" });
  const applying = proposalSchema.parse({ ...base, id: "00000000-0000-4000-8000-000000000004", status: "applying", approved: action, decidedAt: "2026-11-17T12:00:00Z", createdAt: "2026-11-17T11:00:00Z" });
  const proposals = [accepted, rejected, pending, applying]; const before = structuredClone(proposals);
  expect(splitProposals(proposals)).toEqual({ pending: [applying, pending], history: [accepted, rejected] });
  expect(proposals).toEqual(before);
});
