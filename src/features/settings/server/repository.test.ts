import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../schema";
import { createSettingsRepository } from "./repository";

let dir: string;
let repo: ReturnType<typeof createSettingsRepository>;
beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), "tudu-test-settings-")); repo = createSettingsRepository(dir); });
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("settings repository", () => {
  it("clears an old provider's model on provider-only updates and preserves explicit model choices", async () => {
    await repo.updateSettings({ aiModel: "anthropic-custom" });
    expect(await repo.updateSettings({ aiProvider: "openai" })).toMatchObject({ aiProvider: "openai", aiModel: "" });
    expect(await repo.updateSettings({ aiProvider: "openrouter", aiModel: "custom/model" }))
      .toMatchObject({ aiProvider: "openrouter", aiModel: "custom/model" });
  });
  it.each(['{broken', '{"locale":"unknown"}', '{"locale":"pt-BR","unknown":true}'])("uses defaults for invalid stored preferences without overwriting %s", async (content) => {
    const file = path.join(dir, "settings.json");
    await writeFile(file, content);
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(await readFile(file, "utf8")).toBe(content);
    await repo.updateSettings({ locale: "pt-BR" });
    expect(await repo.getSettings()).toEqual({ ...DEFAULT_SETTINGS, locale: "pt-BR" });
  });
  it("returns defaults without creating files until settings are saved", async () => {
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(await readdir(dir)).toEqual([]);
  });
  it("saves every preference atomically and reads it from a new repository instance", async () => {
    const settings = { ...DEFAULT_SETTINGS, locale: "pt-BR", theme: "dark", defaultPriority: "high", startView: "today", dateFormat: "iso" } as const;
    expect(await repo.updateSettings(settings)).toEqual(settings);
    expect(await createSettingsRepository(dir).getSettings()).toEqual(settings);
    expect(await readdir(dir)).toEqual(["settings.json"]);
    expect((await stat(path.join(dir, "settings.json"))).mode & 0o777).toBe(0o600);
  });
  it("normalizes older files and preserves other preferences on partial updates", async () => {
    await writeFile(path.join(dir, "settings.json"), JSON.stringify({ locale: "pt-BR" }));
    expect(await repo.getSettings()).toEqual({ ...DEFAULT_SETTINGS, locale: "pt-BR" });
    await repo.updateSettings({ dateFormat: "iso" });
    expect(await repo.getSettings()).toEqual({ ...DEFAULT_SETTINGS, locale: "pt-BR", dateFormat: "iso" });
  });
  it("does not lose independent preference changes when requests overlap", async () => {
    await Promise.all([repo.updateSettings({ locale: "pt-BR" }), createSettingsRepository(dir).updateSettings({ defaultPriority: "high" })]);
    expect(await repo.getSettings()).toEqual({ ...DEFAULT_SETTINGS, locale: "pt-BR", defaultPriority: "high" });
  });
  it("preserves saved settings when validation fails and recovers on the next update", async () => {
    await repo.updateSettings({ dateFormat: "iso" });
    const before = await readFile(path.join(dir, "settings.json"), "utf8");
    await expect(repo.updateSettings({ locale: "invalid" } as never)).rejects.toThrow();
    expect(await readFile(path.join(dir, "settings.json"), "utf8")).toBe(before);
    expect(await repo.updateSettings({ startView: "today" })).toMatchObject({ startView: "today", dateFormat: "iso" });
  });
});
