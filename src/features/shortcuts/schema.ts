import { z } from "zod";

/** Where a shortcut listens. `global` and `list` are heard on the whole page; the others belong to one field. */
export const SHORTCUT_SCOPES = ["global", "list", "composer", "search", "panel", "assistant"] as const;
export type ShortcutScope = (typeof SHORTCUT_SCOPES)[number];

export const SHORTCUT_IDS = [
  "newTask", "search", "help", "undo", "goAll", "goToday", "goWorkLog", "goAssistant", "goSettings",
  "nextTask", "previousTask", "toggleTask", "editTask", "openTask", "deleteTask",
  "submitTask", "newTaskLine", "submitWithAi", "leaveComposer", "nextSuggestion", "previousSuggestion", "acceptSuggestion", "undoFromField",
  "searchResults", "clearSearch", "closePanel",
  "sendNote", "noteLine", "recallNote",
] as const;
export type ShortcutId = (typeof SHORTCUT_IDS)[number];

const bindingSchema = z.object({
  /** Keys pressed in turn. `Mod` is Ctrl, or ⌘ on a Mac. */
  keys: z.array(z.string().min(1)).min(1).max(2),
  /** `row` needs the task row itself focused; `list` also accepts a control inside a row. */
  within: z.enum(["row", "list"]).optional(),
});
export const shortcutSchema = z.object({
  id: z.enum(SHORTCUT_IDS),
  scope: z.enum(SHORTCUT_SCOPES),
  bindings: z.array(bindingSchema).min(1),
  /** A held key keeps firing. */
  repeats: z.boolean().optional(),
});
export type ShortcutBinding = z.infer<typeof bindingSchema>;
export type Shortcut = z.infer<typeof shortcutSchema>;

const one = (...keys: string[]): ShortcutBinding[] => keys.map((key) => ({ keys: [key] }));

/** The single list of shortcuts: handlers match against it and the help sheet renders it. */
export const SHORTCUTS: readonly Shortcut[] = z.array(shortcutSchema).parse([
  { id: "newTask", scope: "global", bindings: one("n", "Shift+A") },
  { id: "search", scope: "global", bindings: one("/") },
  { id: "goAll", scope: "global", bindings: [{ keys: ["g", "a"] }] },
  { id: "goToday", scope: "global", bindings: [{ keys: ["g", "t"] }] },
  { id: "goWorkLog", scope: "global", bindings: [{ keys: ["g", "w"] }] },
  { id: "goAssistant", scope: "global", bindings: [{ keys: ["g", "i"] }] },
  { id: "goSettings", scope: "global", bindings: [{ keys: ["g", "s"] }] },
  { id: "undo", scope: "global", bindings: one("z", "Mod+z") },
  { id: "help", scope: "global", bindings: one("?") },
  { id: "nextTask", scope: "list", repeats: true, bindings: [{ keys: ["j"] }, { keys: ["ArrowDown"], within: "list" }] },
  { id: "previousTask", scope: "list", repeats: true, bindings: [{ keys: ["k"] }, { keys: ["ArrowUp"], within: "list" }] },
  { id: "toggleTask", scope: "list", bindings: [{ keys: ["Space"], within: "row" }, { keys: ["d"], within: "list" }] },
  { id: "editTask", scope: "list", bindings: [{ keys: ["Enter"], within: "row" }] },
  { id: "openTask", scope: "list", bindings: [{ keys: ["e"], within: "list" }] },
  { id: "deleteTask", scope: "list", bindings: [{ keys: ["Delete"], within: "row" }, { keys: ["Backspace"], within: "row" }] },
  { id: "submitTask", scope: "composer", bindings: one("Enter") },
  { id: "newTaskLine", scope: "composer", bindings: one("Shift+Enter") },
  { id: "submitWithAi", scope: "composer", bindings: one("Mod+Enter") },
  { id: "nextSuggestion", scope: "composer", repeats: true, bindings: one("ArrowDown") },
  { id: "previousSuggestion", scope: "composer", repeats: true, bindings: one("ArrowUp") },
  { id: "acceptSuggestion", scope: "composer", bindings: one("Enter", "Tab") },
  { id: "leaveComposer", scope: "composer", bindings: one("Escape") },
  { id: "undoFromField", scope: "composer", bindings: one("Mod+z") },
  { id: "searchResults", scope: "search", bindings: one("ArrowDown", "Enter") },
  { id: "clearSearch", scope: "search", bindings: one("Escape") },
  { id: "closePanel", scope: "panel", bindings: one("Escape") },
  { id: "sendNote", scope: "assistant", bindings: one("Enter") },
  { id: "noteLine", scope: "assistant", bindings: one("Shift+Enter") },
  { id: "recallNote", scope: "assistant", bindings: one("ArrowUp") },
]);
