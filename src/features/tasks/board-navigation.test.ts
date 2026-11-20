import { describe, expect, it } from "vitest";
import { boardFilterForPage, restoreSidebarLayout, restoreTaskSort, TASK_SORTS, type TaskFilter } from "./board-navigation";

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

describe("sidebar current page", () => {
  const filter: TaskFilter = { kind: "tag", tag: "work" };
  it("marks only the active route or a view on the board", () => {
    expect(boardFilterForPage("/", filter)).toBe(filter);
    for (const page of ["/settings", "/agent", "/work-log"]) expect(boardFilterForPage(page, filter)).toBeNull();
  });
});
