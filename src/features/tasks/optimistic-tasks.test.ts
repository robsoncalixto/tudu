import { describe, expect, it } from "vitest";
import { applyTaskMutations, type PendingTaskMutation } from "./optimistic-tasks";
import { taskSchema } from "./schema";

const saved = taskSchema.parse({
  id: "one", title: "Saved", done: false, createdAt: "2026-11-17T12:00:00Z", completedAt: null,
});
const other = { ...saved, id: "two" };

describe("optimistic task changes", () => {
  it("keeps newer drafts over a confirmed edit or a failed earlier edit", () => {
    const priority: PendingTaskMutation = { id: saved.id, patch: { priority: "high" } };
    const due: PendingTaskMutation = { id: saved.id, patch: { due: "2026-11-18" } };
    expect(applyTaskMutations([saved], [priority, due])[0]).toMatchObject({ priority: "high", due: "2026-11-18" });
    expect(applyTaskMutations([{ ...saved, priority: "high" }], [due])[0]).toMatchObject({ priority: "high", due: "2026-11-18" });
    expect(applyTaskMutations([saved], [due])[0]).toMatchObject({ priority: "medium", due: "2026-11-18" });
    expect(saved).toMatchObject({ priority: "medium", due: null });
  });

  it("keeps a pending deletion hidden and restores only the deleted task on failure", () => {
    const confirmed = [{ ...saved, title: "Renamed" }, { ...other, done: true }];
    const remove: PendingTaskMutation = { id: saved.id, patch: null };
    expect(applyTaskMutations(confirmed, [remove])).toEqual([confirmed[1]]);
    expect(applyTaskMutations(confirmed, [])).toEqual(confirmed);
  });
});
