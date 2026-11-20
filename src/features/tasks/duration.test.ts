import { describe, expect, it } from "vitest";
import { changeDurationUnit, durationLabel, durationToHours, formatDuration } from "./duration";
import type { DurationDraft } from "./schema";

describe("task duration units", () => {
  it.each([
    ["90", "minutes", 1.5], ["1.5", "hours", 1.5], ["1", "days", 12],
    ["0.5", "days", 6], ["1", "minutes", 1 / 60], ["0.25", "hours", 0.25],
    ["", "hours", null], ["  ", "days", null], ["8760", "hours", 8760],
  ] as const)("converts %s %s to hours", (value, unit, hours) => {
    expect(durationToHours(value, unit)).toMatchObject({ success: true, data: hours });
  });

  it.each(["-1", "0", "NaN", "Infinity", "no time", "8760.1"])("rejects invalid hours: %s", (value) => {
    expect(durationToHours(value, "hours").success).toBe(false);
  });

  it("applies the same limit after conversion in every unit", () => {
    expect(durationToHours("525601", "minutes").success).toBe(false);
    expect(durationToHours("731", "days").success).toBe(false);
    expect(durationToHours("730", "days")).toMatchObject({ success: true, data: 8760 });
  });

  it("switches units without losing exact hours, including repeating decimals", () => {
    let draft: DurationDraft = { value: "1", unit: "minutes" };
    for (const unit of ["hours", "days", "hours", "minutes"] as const) draft = changeDurationUnit(draft, unit);
    expect(draft).toEqual({ value: "1", unit: "minutes", hours: 1 / 60 });
    expect(changeDurationUnit({ value: "1.5", unit: "hours" }, "minutes")).toEqual({ value: "90", unit: "minutes", hours: 1.5 });
    expect(changeDurationUnit({ value: "", unit: "hours" }, "days")).toEqual({ value: "", unit: "days", hours: null });
    expect(changeDurationUnit({ value: "-1", unit: "hours" }, "days")).toEqual({ value: "-1", unit: "days" });
    expect(formatDuration(12, "days")).toBe("1");
  });
});

describe("duration labels", () => {
  it.each([
    [0.25, "en", "15 minutes"], [0.5, "pt-BR", "30 minutos"], [1, "en", "1 hour"], [1.5, "pt-BR", "1,5 hora"],
    [2, "pt-BR", "2 horas"], [12, "en", "1 day"], [24, "pt-BR", "2 dias"], [13, "en", "13 hours"],
  ] as const)("writes %s hours in %s as %s", (hours, locale, label) => {
    expect(durationLabel(hours, locale)).toBe(label);
  });
});
