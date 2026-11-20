import { describe, expect, it } from "vitest";
import { restoreBoardReturn, restoreSidebarLayout, restoreTaskSort, TASK_SORTS, type BoardReturn, type TaskFilter } from "./board-navigation";

const previous: BoardReturn = {
  startView: "all", filter: { kind: "today" }, query: "draft", sort: "priority", text: "Follow up",
};

describe("task sort preference", () => {
  it.each(TASK_SORTS)("restores %s", (sort) => expect(restoreTaskSort(sort)).toBe(sort));
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

describe("returning to the board", () => {
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
