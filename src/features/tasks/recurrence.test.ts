import { describe, expect, it } from "vitest";
import { repeatRuleSchema, type RepeatRule } from "@/features/recurrence/schema";
import { taskInputSchema, taskPatchSchema, taskSchema } from "./schema";
import { nextDueDate, validateRepeat } from "./recurrence";
import { dictionaries } from "@/i18n";

describe("repeat rules", () => {
  it("ends next-occurrence notices with one period even when Intl abbreviates a month", () => {
    expect(dictionaries["pt-BR"].nextOccurrence("23 de nov.")).toBe("Próxima tarefa programada para 23 de nov.");
    expect(dictionaries.en.nextOccurrence("Nov 23")).toBe("Next task scheduled for Nov 23.");
  });
  it("validates every frequency and sorts unique weekly days", () => {
    expect(repeatRuleSchema.parse({ frequency: "weekly", days: [5, 1, 3] })).toEqual({ frequency: "weekly", days: [1, 3, 5] });
    for (const rule of [
      { frequency: "hourly" }, { frequency: "weekly", days: [] }, { frequency: "weekly", days: [1, 1] },
      { frequency: "weekly", days: [7] }, { frequency: "weekly", days: [1.5] },
      { frequency: "monthly", day: 0 }, { frequency: "monthly", day: 32 },
    ]) expect(repeatRuleSchema.safeParse(rule).success).toBe(false);
    expect(taskPatchSchema.parse({ repeat: null })).toEqual({ repeat: null });
    expect(taskInputSchema.parse({ title: "New" }).repeat).toBeNull();
    const legacy = taskSchema.parse({ id: "old", title: "Old", done: false, createdAt: "2026-11-17T12:00:00Z", completedAt: null });
    expect(legacy.repeat).toBeNull();
    expect(legacy.nextOccurrenceId).toBeNull();
  });
  it("requires a real scheduled date only when repeating", () => {
    validateRepeat(null, null);
    for (const due of [null, "today", "2026-02-30", "2026-13-01"]) {
      expect(() => validateRepeat(due, { frequency: "daily" })).toThrow("invalid_repeat");
    }
  });
});

describe("nextDueDate", () => {
  it.each<{ due: string; rule: RepeatRule; next: string }>([
    { due: "2026-11-17", rule: { frequency: "daily" }, next: "2026-11-18" },
    { due: "2026-12-31", rule: { frequency: "daily" }, next: "2027-01-01" },
    { due: "2028-02-28", rule: { frequency: "daily" }, next: "2028-02-29" },
    { due: "2026-03-07", rule: { frequency: "daily" }, next: "2026-03-08" },
    { due: "2026-11-20", rule: { frequency: "weekdays" }, next: "2026-11-23" },
    { due: "2026-11-21", rule: { frequency: "weekdays" }, next: "2026-11-23" },
    { due: "2026-11-22", rule: { frequency: "weekdays" }, next: "2026-11-23" },
    { due: "2026-11-17", rule: { frequency: "weekdays" }, next: "2026-11-18" },
    { due: "2026-11-17", rule: { frequency: "weekly", days: [2] }, next: "2026-11-24" },
    { due: "2026-11-17", rule: { frequency: "weekly", days: [1, 5] }, next: "2026-11-20" },
    { due: "2026-11-20", rule: { frequency: "weekly", days: [0] }, next: "2026-11-22" },
    { due: "2026-01-31", rule: { frequency: "monthly", day: 31 }, next: "2026-02-28" },
    { due: "2026-02-28", rule: { frequency: "monthly", day: 31 }, next: "2026-03-31" },
    { due: "2028-01-31", rule: { frequency: "monthly", day: 31 }, next: "2028-02-29" },
    { due: "2026-12-15", rule: { frequency: "monthly", day: 15 }, next: "2027-01-15" },
    { due: "2026-11-17", rule: { frequency: "monthly", day: 20 }, next: "2026-11-20" },
  ])("advances $due with $rule to $next", ({ due, rule, next }) => expect(nextDueDate(due, rule)).toBe(next));
  it("rejects dates outside the supported calendar rather than saving an invalid occurrence", () => {
    expect(() => nextDueDate("9999-12-31", { frequency: "daily" })).toThrow("invalid_repeat");
  });
});
