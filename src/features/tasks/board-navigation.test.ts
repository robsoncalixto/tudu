import { describe, expect, it } from "vitest";
import { boardFilterForPage, restoreBoardReturn, type BoardReturn, restoreSidebarLayout, restoreTaskSort, TASK_SORTS, type TaskFilter } from "./board-navigation";

describe("task sort preference", () => {
  it.each(TASK_SORTS)("restores %s", (sort) => expect(restoreTaskSort(sort, sort === "manual" ? "manual" : "due")).toBe(sort));
  it.each([null, "", "unknown", "{}"])("falls back to due date for %s", (sort) => expect(restoreTaskSort(sort)).toBe("due"));
});

describe("sidebar layout", () => {
  it("restores independent sections and compact mode", () => {
    const layout = { compact: true, projects: false, tags: true };
    expect(restoreSidebarLayout(JSON.stringify(layout))).toEqual(layout);
  });

  it.each([null, "", "{", "[]", '{"compact":"true"}'])("uses expanded navigation for missing or unreadable preferences", (stored) => {
    expect(restoreSidebarLayout(stored)).toEqual({ compact: false, projects: true, tags: true });
  });
});

describe("sidebar current page", () => {
  const filter: TaskFilter = { kind: "tag", tag: "work" };
  it("marks only the active route or a view on the board", () => {
    expect(boardFilterForPage("/", filter)).toBe(filter);
    for (const page of ["/settings", "/agent", "/work-log"]) expect(boardFilterForPage(page, filter)).toBeNull();
  });
});

const previous: BoardReturn = {
  startView: "all", filter: { kind: "today" }, query: "draft", sort: "priority", text: "Follow up",
};

describe("returning to the board", () => {
  it("restores the unfinished task's explicit fields and the tag still being typed", () => {
    const details = { priority: "high", due: "2026-11-20", tags: ["review"], tagInput: " Team " };
    const saved = { ...previous, details };
    expect(restoreBoardReturn(JSON.stringify(saved), "all")).toEqual(saved);
    expect(restoreBoardReturn(JSON.stringify(saved), "today")).toMatchObject({ text: previous.text, details });
  });

  it("keeps a text-only draft when older settings lack details or saved details are unreadable", () => {
    expect(restoreBoardReturn(JSON.stringify(previous), "all")).toEqual(previous);
    expect(restoreBoardReturn(JSON.stringify({ ...previous, details: { priority: "unknown" } }), "all")).toEqual(previous);
  });

  it.each<TaskFilter>([
    { kind: "all" }, { kind: "today" }, { kind: "tag", tag: "work" },
    { kind: "project", id: "a3ec7d64-1468-4bf9-81df-5f6eafe1f642" },
  ])("restores the $kind view along with its search, sort and draft", (filter) => {
    const snapshot = { ...previous, filter };
    expect(restoreBoardReturn(JSON.stringify(snapshot), "all")).toEqual(snapshot);
  });

  it("uses a newly saved initial view and preserves the unfinished task", () => {
    expect(restoreBoardReturn(JSON.stringify({ ...previous, filter: { kind: "tag", tag: "work" } }), "today"))
      .toEqual({ ...previous, startView: "today", filter: { kind: "today" }, query: "" });
  });

  it.each([null, "{", "[]",
    JSON.stringify({ ...previous, filter: { kind: "project", id: "missing" } }),
  ])("ignores missing or invalid navigation state", (serialized) => {
    expect(restoreBoardReturn(serialized, "all")).toBeNull();
  });
});
