import { describe, expect, it } from "vitest";
import { dictionaries } from "@/i18n";
import { SHORTCUT_IDS, SHORTCUT_SCOPES, SHORTCUTS } from "./schema";
import { chordOf, isCharacterBinding, keycaps, matchShortcut, scopeShortcuts, type ShortcutContext } from "./selectors";

const stroke = (key: string, extra: Partial<Parameters<typeof chordOf>[0]> = {}) => ({
  key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...extra,
});
const anywhere: ShortcutContext = { characters: true, within: null, repeat: false };
const onRow: ShortcutContext = { ...anywhere, within: "row" };
const inRow: ShortcutContext = { ...anywhere, within: "list" };

describe("the shortcut registry", () => {
  it("lists every shortcut once and gives each a label in both languages", () => {
    expect(SHORTCUTS.map(({ id }) => id).sort()).toEqual([...SHORTCUT_IDS].sort());
    for (const t of Object.values(dictionaries)) {
      expect(Object.keys(t.shortcuts.labels).sort()).toEqual([...SHORTCUT_IDS].sort());
      expect(Object.keys(t.shortcuts.scopes).sort()).toEqual([...SHORTCUT_SCOPES].sort());
    }
  });

  it("never binds the same key twice where both could fire", () => {
    const seen = new Set<string>();
    for (const { scope, bindings } of SHORTCUTS) {
      if (scope !== "global" && scope !== "list") continue;
      for (const { keys, within } of bindings) {
        const key = `${keys.join(" ")}|${within ?? ""}`;
        expect(seen.has(key), key).toBe(false);
        seen.add(key);
      }
    }
    // A sequence's first key cannot also be a shortcut on its own.
    const prefixes = SHORTCUTS.flatMap(({ bindings }) => bindings.filter(({ keys }) => keys.length === 2).map(({ keys }) => keys[0]));
    for (const prefix of prefixes) expect(matchShortcut(prefix, null, onRow)).toEqual({ kind: "wait", prefix });
  });
});

describe("naming a key press", () => {
  it.each([
    [stroke("n"), "n"], [stroke("N"), "n"], [stroke("A", { shiftKey: true }), "Shift+A"], [stroke("a", { shiftKey: true }), "Shift+A"],
    [stroke("?", { shiftKey: true }), "?"], [stroke("/"), "/"], [stroke(" "), "Space"],
    [stroke("Enter", { ctrlKey: true }), "Mod+Enter"], [stroke("Enter", { metaKey: true }), "Mod+Enter"],
    [stroke("Enter", { shiftKey: true }), "Shift+Enter"], [stroke("z", { metaKey: true }), "Mod+z"],
    [stroke("Z", { metaKey: true, shiftKey: true }), "Mod+Shift+Z"], [stroke("n", { altKey: true }), "Alt+n"], [stroke("ArrowDown"), "ArrowDown"],
  ])("%o is %s", (event, chord) => expect(chordOf(event)).toBe(chord));
});

describe("shortcuts heard on the page", () => {
  it.each([
    ["n", "newTask"], ["Shift+A", "newTask"], ["/", "search"], ["?", "help"], ["z", "undo"], ["Mod+z", "undo"], ["j", "nextTask"], ["k", "previousTask"],
  ])("%s runs %s from anywhere", (chord, id) => expect(matchShortcut(chord, null, anywhere)).toEqual({ kind: "run", id }));

  it.each([["a", "goAll"], ["t", "goToday"], ["w", "goWorkLog"], ["i", "goAssistant"], ["s", "goSettings"]])(
    "g then %s runs %s", (second, id) => {
      expect(matchShortcut("g", null, anywhere)).toEqual({ kind: "wait", prefix: "g" });
      expect(matchShortcut(second, "g", anywhere)).toEqual({ kind: "run", id });
    });

  it("reads a key on its own when it does not finish the sequence", () => {
    expect(matchShortcut("n", "g", anywhere)).toEqual({ kind: "run", id: "newTask" });
    expect(matchShortcut("x", "g", anywhere)).toBeNull();
    expect(matchShortcut("t", null, anywhere)).toBeNull();
  });

  it("acts on a task only while its row has focus", () => {
    for (const [chord, id] of [["Space", "toggleTask"], ["Enter", "editTask"], ["Delete", "deleteTask"], ["Backspace", "deleteTask"]] as const) {
      expect(matchShortcut(chord, null, onRow)).toEqual({ kind: "run", id });
      // Space and Enter on a button inside the row belong to that button.
      expect(matchShortcut(chord, null, inRow)).toBeNull();
      expect(matchShortcut(chord, null, anywhere)).toBeNull();
    }
    for (const [chord, id] of [["d", "toggleTask"], ["e", "openTask"], ["ArrowDown", "nextTask"], ["ArrowUp", "previousTask"]] as const) {
      expect(matchShortcut(chord, null, onRow)).toEqual({ kind: "run", id });
      expect(matchShortcut(chord, null, inRow)).toEqual({ kind: "run", id });
      // Arrows keep scrolling the page when no task has focus.
      expect(matchShortcut(chord, null, anywhere)).toBeNull();
    }
  });

  it("keeps only non-character shortcuts when single keys are switched off", () => {
    const off = { ...onRow, characters: false };
    for (const chord of ["n", "Shift+A", "/", "?", "z", "j", "k", "d", "e", "g"]) expect(matchShortcut(chord, null, off)).toBeNull();
    for (const [chord, id] of [["Mod+z", "undo"], ["Space", "toggleTask"], ["Enter", "editTask"], ["ArrowDown", "nextTask"], ["Delete", "deleteTask"]] as const) {
      expect(matchShortcut(chord, null, off)).toEqual({ kind: "run", id });
    }
  });

  it("repeats navigation while a key is held and nothing else", () => {
    const held = { ...onRow, repeat: true };
    expect(matchShortcut("j", null, held)).toEqual({ kind: "run", id: "nextTask" });
    expect(matchShortcut("ArrowUp", null, held)).toEqual({ kind: "run", id: "previousTask" });
    for (const chord of ["Space", "d", "Delete", "n", "?", "g", "z"]) expect(matchShortcut(chord, null, held)).toBeNull();
  });

  it("ignores modified keys and names inherited from objects", () => {
    for (const chord of ["Mod+n", "Alt+n", "Mod+Shift+Z", "Shift+Space", "constructor", "toString", "__proto__"]) {
      expect(matchShortcut(chord, null, onRow)).toBeNull();
    }
  });
});

describe("shortcuts a field handles itself", () => {
  it("offers every shortcut bound to the key so the field can choose by its state", () => {
    expect(scopeShortcuts("composer", "Enter")).toEqual(["submitTask", "acceptSuggestion"]);
    expect(scopeShortcuts("composer", "Mod+Enter")).toEqual(["submitWithAi"]);
    expect(scopeShortcuts("composer", "Shift+Enter")).toEqual(["newTaskLine"]);
    expect(scopeShortcuts("composer", "Escape")).toEqual(["leaveComposer"]);
    expect(scopeShortcuts("composer", "Mod+z")).toEqual(["undoFromField"]);
    expect(scopeShortcuts("search", "Escape")).toEqual(["clearSearch"]);
    expect(scopeShortcuts("assistant", "ArrowUp")).toEqual(["recallNote"]);
    expect(scopeShortcuts("composer", "n")).toEqual([]);
    expect(scopeShortcuts("global", "g")).toEqual([]);
  });
});

describe("showing keys", () => {
  it("separates characters from named keys and adapts the modifier to the platform", () => {
    expect(isCharacterBinding({ keys: ["g", "t"] })).toBe(true);
    expect(isCharacterBinding({ keys: ["Shift+A"] })).toBe(true);
    for (const key of ["Mod+z", "Space", "Enter", "ArrowDown", "Delete"]) expect(isCharacterBinding({ keys: [key] })).toBe(false);
    expect(keycaps("Mod+Enter", true)).toEqual(["⌘", "Enter"]);
    expect(keycaps("Mod+z", false)).toEqual(["Ctrl", "Z"]);
    expect(keycaps("Shift+A", false)).toEqual(["Shift", "A"]);
    expect(keycaps("ArrowDown", false)).toEqual(["↓"]);
    expect(keycaps("?", false)).toEqual(["?"]);
  });
});
