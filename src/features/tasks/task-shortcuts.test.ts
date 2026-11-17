import { describe, expect, it } from "vitest";
import { taskShortcut } from "./task-shortcuts";

const key = (key: string, extra: Partial<Parameters<typeof taskShortcut>[0]> = {}) => ({
  key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, defaultPrevented: false, ...extra,
});

describe("task keyboard shortcuts", () => {
  it.each([
    ["n", "composer"], ["/", "composer"], ["j", "next"], ["ArrowDown", "next"],
    ["k", "previous"], ["ArrowUp", "previous"], ["x", "toggle"],
    ["Delete", "delete"], ["Backspace", "delete"], ["?", "help"],
  ])("maps %s to %s", (input, action) => expect(taskShortcut(key(input), false, false)).toBe(action));
  it("ignores editable contexts, modals, handled events and modified browser shortcuts", () => {
    expect(taskShortcut(key("x"), true, false)).toBeNull();
    expect(taskShortcut(key("x"), false, true)).toBeNull();
    for (const modifier of ["ctrlKey", "metaKey", "altKey", "shiftKey", "defaultPrevented"] as const) {
      expect(taskShortcut(key("x", { [modifier]: true }), false, false)).toBeNull();
    }
    expect(taskShortcut(key("?", { shiftKey: true }), false, false)).toBe("help");
    expect(taskShortcut(key("J"), false, false)).toBe("next");
  });
  it("allows held navigation keys but never repeats mutations, composer focus or help", () => {
    for (const input of ["x", "Delete", "Backspace", "?", "n", "/"]) {
      expect(taskShortcut(key(input, { repeat: true }), false, false)).toBeNull();
    }
    expect(taskShortcut(key("ArrowDown", { repeat: true }), false, false)).toBe("next");
    expect(taskShortcut(key("k", { repeat: true }), false, false)).toBe("previous");
  });
  it("leaves unrelated keys and prototype names alone", () => {
    for (const input of ["Enter", "Tab", " ", "Escape", "constructor", "toString", "__proto__"]) {
      expect(taskShortcut(key(input), false, false)).toBeNull();
    }
  });
});
