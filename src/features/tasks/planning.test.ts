import { describe, expect, it } from "vitest";
import { postponementDate } from "./planning";

describe("task postponement", () => {
  it.each([
    ["2026-04-30", "2026-05-01", "2026-05-04"],
    ["2026-12-31", "2027-01-01", "2027-01-04"],
    ["2026-11-16", "2026-11-17", "2026-11-23"],
    ["2026-11-22", "2026-11-23", "2026-11-23"],
  ])("calculates tomorrow and the next Monday from %s", (today, tomorrow, nextMonday) => {
    expect(postponementDate(today, "tomorrow")).toBe(tomorrow);
    expect(postponementDate(today, "next-week")).toBe(nextMonday);
  });
});
