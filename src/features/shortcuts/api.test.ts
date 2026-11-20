import { afterEach, describe, expect, it, vi } from "vitest";

const key = (name: string, extra = {}) => ({ key: name, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...extra });

async function freshApi(storage?: Partial<Storage>) {
  vi.resetModules();
  if (storage) vi.stubGlobal("localStorage", storage);
  return (await import("./api")).shortcutsApi;
}

afterEach(() => vi.unstubAllGlobals());

describe("running a shortcut", () => {
  it("asks the most recently mounted handler first and stops at the first that accepts", async () => {
    const api = await freshApi();
    const calls: string[] = [];
    const stopOuter = api.subscribe("newTask", () => { calls.push("workspace"); });
    api.subscribe("newTask", () => { calls.push("board"); return false; });
    expect(api.run("newTask")).toBe(true);
    expect(calls).toEqual(["board", "workspace"]);
    stopOuter();
    calls.length = 0;
    // Every remaining handler declined, so the key keeps its browser behaviour.
    expect(api.run("newTask")).toBe(false);
    expect(calls).toEqual(["board"]);
    expect(api.run("help")).toBe(false);
  });

  it("passes the element the key was pressed on", async () => {
    const api = await freshApi();
    const target = { id: "row" } as HTMLElement;
    const seen: (HTMLElement | null)[] = [];
    api.subscribe("toggleTask", (element) => { seen.push(element); });
    api.run("toggleTask", target);
    api.run("toggleTask");
    expect(seen).toEqual([target, null]);
  });
});

describe("a field's own keys", () => {
  it("reads the key press against that field's shortcuts only", async () => {
    const api = await freshApi();
    expect(api.match("composer", key("Enter"))).toEqual(["submitTask", "acceptSuggestion"]);
    expect(api.match("composer", key("Enter", { metaKey: true }))).toEqual(["submitWithAi"]);
    expect(api.match("assistant", key("Enter"))).toEqual(["sendNote"]);
    expect(api.match("search", key("n"))).toEqual([]);
  });

  it("gives the keycaps for a hint beside the field", async () => {
    const api = await freshApi();
    expect(api.keys("assistant", false)).toEqual([
      { id: "sendNote", caps: ["Enter"] }, { id: "noteLine", caps: ["Shift", "Enter"] }, { id: "recallNote", caps: ["↑"] },
    ]);
    expect(api.keys("composer", true).find(({ id }) => id === "submitWithAi")?.caps).toEqual(["⌘", "Enter"]);
  });
});

describe("the single-key preference", () => {
  it("is on until switched off, is remembered on the device and tells whoever is watching", async () => {
    const saved = new Map<string, string>();
    const api = await freshApi({ getItem: (name) => saved.get(name) ?? null, setItem: (name, value) => { saved.set(name, value); } });
    const watcher = vi.fn();
    const stop = api.watchCharacters(watcher);
    expect(api.charactersEnabled()).toBe(true);
    api.setCharactersEnabled(false);
    expect(api.charactersEnabled()).toBe(false);
    expect(saved.get("tudu.characterShortcuts")).toBe("off");
    expect(watcher).toHaveBeenCalledOnce();
    stop();
    api.setCharactersEnabled(true);
    expect(watcher).toHaveBeenCalledOnce();
    expect((await freshApi({ getItem: () => "off", setItem: () => {} })).charactersEnabled()).toBe(false);
  });

  it("keeps working for the visit when the device refuses storage", async () => {
    const refuse = () => { throw new Error("blocked"); };
    const api = await freshApi({ getItem: refuse, setItem: refuse });
    expect(api.charactersEnabled()).toBe(true);
    api.setCharactersEnabled(false);
    expect(api.charactersEnabled()).toBe(false);
  });
});
