import { describe, expect, it } from "vitest";
import { composerDefaults, composerValues, NO_CHOICE, withoutTag, withTag } from "./composer-draft";

const today = "2026-11-17";
const site = { id: "00000000-0000-4000-8000-000000000001", name: "Website redesign" };
const other = "00000000-0000-4000-8000-000000000002";

describe("chip choices over the current view", () => {
  it("follows the view until a chip says otherwise", () => {
    expect(composerDefaults({ plannedFor: today }, NO_CHOICE)).toEqual({ tags: [], plannedFor: today });
    expect(composerDefaults({ projectId: site.id }, NO_CHOICE)).toEqual({ tags: [], projectId: site.id });
    expect(composerDefaults({ tag: "work" }, NO_CHOICE)).toEqual({ tags: [], tag: "work" });
    expect(composerDefaults({}, NO_CHOICE)).toEqual({ tags: [] });
  });

  it("lets a chip replace or drop what the view would add", () => {
    expect(composerDefaults({ plannedFor: today }, { tags: [], plannedFor: null })).toEqual({ tags: [] });
    expect(composerDefaults({ plannedFor: today }, { tags: [], plannedFor: "2026-11-18" })).toEqual({ tags: [], plannedFor: "2026-11-18" });
    expect(composerDefaults({ projectId: site.id }, { tags: [], projectId: null })).toEqual({ tags: [] });
    expect(composerDefaults({ projectId: site.id }, { tags: [], projectId: other })).toEqual({ tags: [], projectId: other });
    expect(composerDefaults({ tag: "work" }, { tags: ["team"], withoutViewTag: true })).toEqual({ tags: ["team"] });
  });

  it("carries every picked value", () => {
    expect(composerDefaults({}, { tags: ["a"], priority: "high", due: "2026-11-20", estimateHours: 0.5 }))
      .toEqual({ tags: ["a"], priority: "high", due: "2026-11-20", estimateHours: 0.5 });
  });
});

describe("what the chips show", () => {
  it("shows the defaults while nothing is typed", () => {
    expect(composerValues("", today, { tags: ["team"], tag: "Work", plannedFor: today, priority: "low" }, [site])).toEqual({
      batch: false, priority: "low", due: null, time: null, partOfDay: null, plannedFor: today, projectId: null, tags: ["team", "Work"], estimateHours: null,
    });
  });

  it("shows typed tokens over the defaults for a single line, even before there is a title", () => {
    expect(composerValues("#bug !alta @amanha 14h +website-redesign t30m", today, { tags: ["team"], priority: "low", due: today, projectId: other, estimateHours: 2 }, [site]))
      .toEqual({ batch: false, priority: "high", due: "2026-11-18", time: "14:00", partOfDay: "afternoon", plannedFor: null, projectId: site.id, tags: ["bug", "team"], estimateHours: 0.5 });
  });

  it("counts a tag once whether it was typed, picked or comes from the view", () => {
    expect(composerValues("Plan #Work #team", today, { tags: ["team", "work"], tag: "work" }, []).tags).toEqual(["work", "team"]);
  });

  it("keeps to the defaults when several lines are typed", () => {
    expect(composerValues("One !alta #a\n\nTwo @amanha", today, { tags: ["team"], priority: "low" }, []))
      .toMatchObject({ batch: true, priority: "low", due: null, tags: ["team"] });
    expect(composerValues("One !alta\n  \n", today, { tags: [] }, [])).toMatchObject({ batch: false, priority: "high" });
  });
});

describe("picked tags", () => {
  it("adds a normalized tag once", () => {
    expect(withTag(NO_CHOICE, " #Team ")).toEqual({ tags: ["team"] });
    expect(withTag({ tags: ["team"] }, "TEAM")).toEqual({ tags: ["team"] });
    expect(withTag(NO_CHOICE, " # ")).toBe(NO_CHOICE);
  });

  it("removes a picked tag and remembers when the view's tag was dropped", () => {
    expect(withoutTag({ tags: ["team", "bug"] }, "team")).toEqual({ tags: ["bug"] });
    expect(withoutTag({ tags: ["team"] }, "work", "Work")).toEqual({ tags: ["team"], withoutViewTag: true });
    expect(withoutTag({ tags: ["team"] }, "team", "work")).toEqual({ tags: [] });
  });
});
