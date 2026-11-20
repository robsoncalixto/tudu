import { SHORTCUTS, type ShortcutBinding, type ShortcutId, type ShortcutScope } from "./schema";

export type KeyStroke = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">;

/** Names a key press the way bindings are written: "n", "Shift+A", "?", "Mod+Enter", "Space". */
export function chordOf({ key, ctrlKey, metaKey, altKey, shiftKey }: KeyStroke): string {
  const name = key === " " ? "Space" : key;
  const letter = /^\p{L}$/u.test(name);
  // Caps Lock must not change a letter, and symbols such as ? already include Shift.
  const base = letter ? (shiftKey ? name.toUpperCase() : name.toLowerCase()) : name;
  const shift = shiftKey && (letter || name.length > 1) ? "Shift+" : "";
  return `${ctrlKey || metaKey ? "Mod+" : ""}${altKey ? "Alt+" : ""}${shift}${base}`;
}

/** Bindings made only of letters, digits or symbols can fire by accident, so they can be switched off. */
export function isCharacterBinding(binding: ShortcutBinding): boolean {
  return binding.keys.every((key) => /^(Shift\+)?.$/u.test(key));
}

export interface ShortcutContext {
  characters: boolean;
  /** Focus is on a task row, on a control inside one, or elsewhere. */
  within: "row" | "list" | null;
  repeat: boolean;
}

export type ShortcutMatch = { kind: "run"; id: ShortcutId } | { kind: "wait"; prefix: string } | null;

function scan(chord: string, prefix: string | null, context: ShortcutContext): ShortcutMatch {
  let waiting = false;
  for (const shortcut of SHORTCUTS) {
    if ((shortcut.scope !== "global" && shortcut.scope !== "list") || (context.repeat && !shortcut.repeats)) continue;
    for (const binding of shortcut.bindings) {
      if (!context.characters && isCharacterBinding(binding)) continue;
      if (binding.within === "row" ? context.within !== "row" : binding.within === "list" && context.within === null) continue;
      const [first, second] = binding.keys;
      if (second === undefined ? prefix === null && first === chord : prefix === first && second === chord) {
        return { kind: "run", id: shortcut.id };
      }
      if (second !== undefined && prefix === null && first === chord) waiting = true;
    }
  }
  return waiting ? { kind: "wait", prefix: chord } : null;
}

/** Resolves a key press heard on the page. An unfinished sequence is dropped and the key is read on its own. */
export function matchShortcut(chord: string, prefix: string | null, context: ShortcutContext): ShortcutMatch {
  return scan(chord, prefix, context) ?? (prefix === null ? null : scan(chord, null, context));
}

/** Shortcuts that one field handles itself for this key press; the field picks by its own state. */
export function scopeShortcuts(scope: ShortcutScope, chord: string): ShortcutId[] {
  return SHORTCUTS.filter((shortcut) => shortcut.scope === scope
    && shortcut.bindings.some(({ keys }) => keys.length === 1 && keys[0] === chord)).map(({ id }) => id);
}

const SYMBOLS: Record<string, string> = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };

/** The keycaps of one key press, for display: "Mod+Enter" on a Mac is ["⌘", "Enter"]. */
export function keycaps(chord: string, mac: boolean): string[] {
  return chord.split("+").map((part) => part === "Mod" ? (mac ? "⌘" : "Ctrl") : SYMBOLS[part] ?? (part.length === 1 ? part.toUpperCase() : part));
}
