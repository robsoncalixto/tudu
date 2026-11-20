import { SHORTCUTS, type ShortcutId, type ShortcutScope } from "./schema";
import { chordOf, keycaps, scopeShortcuts, type KeyStroke } from "./selectors";

/** Returns false to say the key was not used here, so the browser keeps its own behaviour. */
type ShortcutHandler = (target: HTMLElement | null) => boolean | void;

const PREFERENCE = "tudu.characterShortcuts";
const handlers = new Map<ShortcutId, ShortcutHandler[]>();
const watchers = new Set<() => void>();
let characters: boolean | null = null;

export const shortcutsApi = {
  list: () => SHORTCUTS,

  /** The keys of one field's shortcuts as keycaps, for a hint beside that field. */
  keys: (scope: ShortcutScope, mac: boolean) => SHORTCUTS.filter((shortcut) => shortcut.scope === scope)
    .map(({ id, bindings }) => ({ id, caps: keycaps(bindings[0].keys[0], mac) })),

  /** The shortcuts a field's own key handler should consider for this key press. */
  match: (scope: Exclude<ShortcutScope, "global" | "list">, event: KeyStroke): ShortcutId[] => scopeShortcuts(scope, chordOf(event)),

  subscribe(id: ShortcutId, handler: ShortcutHandler): () => void {
    handlers.set(id, [...(handlers.get(id) ?? []), handler]);
    return () => { handlers.set(id, (handlers.get(id) ?? []).filter((item) => item !== handler)); };
  },

  /** Runs the most recently mounted handler that accepts the shortcut. */
  run(id: ShortcutId, target: HTMLElement | null = null): boolean {
    return [...(handlers.get(id) ?? [])].reverse().some((handler) => handler(target) !== false);
  },

  charactersEnabled(): boolean {
    if (characters === null) {
      try { characters = localStorage.getItem(PREFERENCE) !== "off"; } catch { characters = true; }
    }
    return characters;
  },

  setCharactersEnabled(enabled: boolean) {
    characters = enabled;
    try { localStorage.setItem(PREFERENCE, enabled ? "on" : "off"); } catch { /* The choice lasts for this visit. */ }
    for (const watcher of watchers) watcher();
  },

  watchCharacters(watcher: () => void): () => void {
    watchers.add(watcher);
    return () => { watchers.delete(watcher); };
  },
};
