import type { ShortcutAction } from "./shortcut-schema";

type KeyStroke = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "repeat" | "defaultPrevented">;
const KEY_ACTIONS: Record<string, ShortcutAction> = {
  n: "composer", "/": "composer", j: "next", arrowdown: "next", k: "previous", arrowup: "previous",
  x: "toggle", delete: "delete", backspace: "delete", "?": "help",
};

export function taskShortcut(event: KeyStroke, typing: boolean, modal: boolean): ShortcutAction | null {
  if (typing || modal || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.shiftKey && event.key !== "?") return null;
  const key = event.key.toLowerCase();
  const action = Object.hasOwn(KEY_ACTIONS, key) ? KEY_ACTIONS[key] : undefined;
  if (!action || (event.repeat && action !== "next" && action !== "previous")) return null;
  return action;
}
