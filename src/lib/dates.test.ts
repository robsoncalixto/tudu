import { describe, expect, it } from "vitest";
import { dictionaries } from "@/i18n";
import { dateInTimeZone, dayDiff, dueLabel, formatTimestamp, longDate, toISODate, weekdayName } from "./dates";

it("formats decision timestamps in the requested language and time zone", () => {
  expect(formatTimestamp("2026-11-17T12:30:00Z", "en", "UTC")).toContain("Nov 17, 2026");
  expect(formatTimestamp("2026-11-17T12:30:00Z", "pt-BR", "America/Sao_Paulo")).toContain("09:30");
});

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
  it("keeps the original text of an impossible legacy deadline instead of displaying another date", () => {
    expect(dueLabel("2026-02-30", "2026-03-02", "en", en)).toBe("2026-02-30");
    expect(dueLabel("2026-02-30", "2026-03-02", "pt-BR", pt)).toBe("2026-02-30");
    expect(dayDiff("2026-02-30", TODAY)).toBeNaN();
  });

  it("uses the supplied year for deadlines before year 100", () => {
    expect(dueLabel("0099-06-12", TODAY, "en", en)).toBe("Jun 12, 99");
  });
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
  it("shows the raw value for a calendar-invalid legacy plan in either locale", () => {
    for (const locale of ["en", "pt-BR"] as const) {
      expect(longDate("0000-01-01", locale)).toEqual({ weekday: "", rest: "0000-01-01" });
    }
  });
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
