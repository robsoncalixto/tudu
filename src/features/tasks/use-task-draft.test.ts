import { expect, it } from "vitest";
import { updateTaskDraft } from "./use-task-draft";

it("clears only the submitted revision and preserves another task's draft", () => {
  let edits = new Map<string, string>();
  edits = updateTaskDraft(edits, "one", undefined, "original");
  edits = updateTaskDraft(edits, "two", undefined, "other task");
  edits = updateTaskDraft(edits, "one", "original", "new edit");
  expect(updateTaskDraft(edits, "one", "original", undefined)).toBe(edits);
  expect([...updateTaskDraft(edits, "one", "new edit", undefined)]).toEqual([["two", "other task"]]);
});
