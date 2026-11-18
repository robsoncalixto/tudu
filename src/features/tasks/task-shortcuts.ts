import type { ShortcutAction } from "./shortcut-schema";

type KeyStroke = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "repeat" | "defaultPrevented" | "isComposing">;
const KEY_ACTIONS: Record<string, ShortcutAction> = {
  n: "composer", "/": "composer", j: "next", arrowdown: "next", k: "previous", arrowup: "previous",
  i: "task-panel", a: "add-subtask", x: "toggle", delete: "delete", backspace: "delete", "?": "help",
};

export function taskShortcut(event: KeyStroke, typing: boolean | "composer", modal: boolean): ShortcutAction | null {
  if (modal || event.isComposing || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.shiftKey && event.key !== "?") return null;
  if (typing === "composer" && event.key === "Escape" && !event.repeat) return "leave-composer";
  if (typing) return null;
  const key = event.key.toLowerCase();
  const action = Object.hasOwn(KEY_ACTIONS, key) ? KEY_ACTIONS[key] : undefined;
  if (!action || (event.repeat && action !== "next" && action !== "previous")) return null;
  return action;
}
