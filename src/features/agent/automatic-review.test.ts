import { describe, expect, it } from "vitest";
import { automaticReviewDay } from "./automatic-review";

const enabled = { enabled: true, timeZone: "America/Sao_Paulo", time: "09:00", enabledAt: "2026-11-16T12:00:00Z" };

describe("daily automatic review", () => {
  it("uses the chosen time zone and waits until a missed schedule exists", () => {
    expect(automaticReviewDay(new Date("2026-11-16T11:59:00Z"), enabled, null)).toBeNull();
    expect(automaticReviewDay(new Date("2026-11-16T12:00:00Z"), enabled, null)).toBe("2026-11-16");
    expect(automaticReviewDay(new Date("2026-11-17T08:00:00Z"), enabled, null)).toBe("2026-11-17");
  });

  it("does not rerun on the same local day or while disabled", () => {
    const now = new Date("2026-11-18T01:00:00Z");
    expect(automaticReviewDay(now, enabled, "2026-11-17T12:00:00Z")).toBeNull();
    expect(automaticReviewDay(now, { ...enabled, enabled: false }, null)).toBeNull();
    expect(automaticReviewDay(new Date("2026-11-17T11:59:00Z"), enabled, "2026-11-16T19:00:00Z")).toBeNull();
  });
});
