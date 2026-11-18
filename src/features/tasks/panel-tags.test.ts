import { describe, expect, it } from "vitest";
import { formatPanelTags, parsePanelTags } from "./panel-tags";

describe("editing task tags", () => {
  it("trims separators and preserves punctuation in existing tags", () => {
    const tags = ["Research, design", "C:\\projects", "São Paulo"];
    expect(parsePanelTags(formatPanelTags(tags))).toEqual(tags);
    expect(parsePanelTags(" work, , design,  ")).toEqual(["work", "design"]);
    expect(parsePanelTags("")).toEqual([]);
  });
});
