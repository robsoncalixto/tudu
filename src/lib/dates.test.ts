import { describe, expect, it } from "vitest";
import { dictionaries } from "@/i18n";
import { dateInTimeZone, dayDiff, dueLabel, longDate, toISODate, weekdayName } from "./dates";

it("finds a timestamp's calendar date in the requested time zone", () => {
  expect(dateInTimeZone("2026-11-17T02:59:59Z", "America/Sao_Paulo")).toBe("2026-11-16");
  expect(dateInTimeZone("2026-11-17T03:00:00Z", "America/Sao_Paulo")).toBe("2026-11-17");
  expect(dateInTimeZone("not a timestamp", "UTC")).toBeNull();
});

it("formats weekly day names with Intl in both languages", () => {
  expect(weekdayName(0, "en")).toBe("Sunday");
  expect(weekdayName(1, "pt-BR")).toBe("segunda-feira");
  expect(weekdayName(6, "en")).toBe("Saturday");
});

const en = dictionaries.en;
const pt = dictionaries["pt-BR"];
const TODAY = "2026-11-17";

describe("toISODate", () => {
  it("uses the local calendar day and pads month and day", () => {
    expect(toISODate(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("dayDiff", () => {
  it("counts whole days, negative when in the past", () => {
    expect(dayDiff("2026-11-17", TODAY)).toBe(0);
    expect(dayDiff("2026-11-20", TODAY)).toBe(3);
    expect(dayDiff("2026-11-10", TODAY)).toBe(-7);
  });

  it("is not thrown off by daylight-saving changes", () => {
    expect(dayDiff("2026-03-09", "2026-03-08")).toBe(1);
    expect(dayDiff("2026-11-02", "2026-11-01")).toBe(1);
  });

  it("crosses year boundaries", () => {
    expect(dayDiff("2027-01-01", "2026-12-31")).toBe(1);
  });
});

describe("dueLabel", () => {
  it("names today, tomorrow and yesterday in each language", () => {
    expect(dueLabel("2026-11-17", TODAY, "en", en)).toBe("Today");
    expect(dueLabel("2026-11-18", TODAY, "en", en)).toBe("Tomorrow");
    expect(dueLabel("2026-11-16", TODAY, "pt-BR", pt)).toBe("Ontem");
    expect(dueLabel("2026-11-18", TODAY, "pt-BR", pt)).toBe("Amanhã");
  });

  it("shows day and month for other dates in the same year", () => {
    expect(dueLabel("2026-12-03", TODAY, "en", en)).toBe("Dec 3");
  });

  it("adds the year when it differs from the current one", () => {
    expect(dueLabel("2027-01-05", TODAY, "en", en)).toContain("2027");
  });
});

describe("longDate", () => {
  it("splits weekday and date, localized", () => {
    expect(longDate(TODAY, "en")).toEqual({ weekday: "Tuesday", rest: "November 17" });
    expect(longDate(TODAY, "pt-BR")).toEqual({ weekday: "terça-feira", rest: "17 de novembro" });
  });
});

it("formats the heading and all task dates as ISO when requested", () => {
  expect(longDate("2026-11-17", "en", "iso")).toEqual({ weekday: "Tuesday", rest: "2026-11-17" });
  expect(longDate("2026-11-17", "pt-BR", "iso")).toEqual({ weekday: "terça-feira", rest: "2026-11-17" });
  expect(dueLabel("2026-11-17", "2026-11-17", "en", dictionaries.en, "iso")).toBe("2026-11-17");
  expect(dueLabel("2026-11-16", "2026-11-17", "pt-BR", dictionaries["pt-BR"], "iso")).toBe("2026-11-16");
});
