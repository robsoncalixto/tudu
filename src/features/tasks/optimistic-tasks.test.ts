import { describe, expect, it } from "vitest";
import { applyTaskMutations, isProvisional, provisionalTask, type PendingTaskMutation } from "./optimistic-tasks";
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

it("reapplies pending changes while preserving fresh changes made elsewhere", () => {
  const first = taskSchema.parse({ id: "one", title: "Remote title", notes: "Earlier notes", done: false,
    createdAt: "2026-11-17T12:00:00Z", completedAt: null });
  const deleted = { ...first, id: "two", title: "Locally removed" };
  const added = { ...first, id: "three", title: "Added elsewhere" };
  const result = applyTaskMutations([first, deleted, added], [
    { id: "one", patch: { notes: "Pending notes" } }, { id: "two", patch: null },
  ]);
  expect(result).toEqual([{ ...first, notes: "Pending notes" }, added]);
});

describe("tasks shown before they are saved", () => {
  const now = new Date("2026-11-17T12:00:00Z");

  it("fills a typed draft into a whole task, using the default priority only when none was typed", () => {
    const shown = provisionalTask({ title: "Call Ana", tags: ["work"], due: "2026-11-18", plannedFor: "2026-11-17", estimateHours: 0.5 }, "high", now);
    expect(shown).toMatchObject({
      title: "Call Ana", tags: ["work"], due: "2026-11-18", plannedFor: "2026-11-17", estimateHours: 0.5, priority: "high",
      done: false, createdAt: "2026-11-17T12:00:00.000Z", completedAt: null, notes: "", steps: [], projectId: null,
    });
    expect(provisionalTask({ title: "Call Ana", priority: "low" }, "high", now).priority).toBe("low");
  });

  it("gives each one its own id that no saved task can have", () => {
    const first = provisionalTask({ title: "One" }, "medium", now);
    const second = provisionalTask({ title: "Two" }, "medium", now);
    expect(first.id).not.toBe(second.id);
    expect(isProvisional(first)).toBe(true);
    expect(isProvisional(saved)).toBe(false);
  });
});
