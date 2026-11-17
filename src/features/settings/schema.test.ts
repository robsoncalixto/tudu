import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, settingsChanges, settingsPatchSchema, settingsSchema } from "./schema";

describe("settings schema", () => {
  it("supplies usable defaults for a new or older installation", () => {
    expect(settingsSchema.parse({})).toEqual({ locale: "en", defaultPriority: "medium", startView: "all", dateFormat: "locale", aiProvider: "anthropic", aiModel: "" });
    expect(settingsSchema.parse({ locale: "pt-BR" })).toEqual({ ...DEFAULT_SETTINGS, locale: "pt-BR" });
  });
  it("keeps partial updates partial instead of inserting unrelated defaults", () => {
    expect(settingsPatchSchema.parse({ locale: "pt-BR" })).toEqual({ locale: "pt-BR" });
    expect(settingsPatchSchema.parse({})).toEqual({});
  });
  it("rejects unsupported values and fields that do not belong to public preferences", () => {
    for (const patch of [{ locale: "fr" }, { defaultPriority: "urgent" }, { startView: "missing" },
      { dateFormat: "invalid" }, { locale: null }, { apiKey: "not-a-preference" }, { aiProvider: "unknown" }, { aiModel: "bad model" }, { aiModel: "x".repeat(161) }]) {
      expect(settingsPatchSchema.safeParse(patch).success).toBe(false);
    }
  });
  it("submits only preferences the user changed", () => {
    expect(settingsChanges(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, defaultPriority: "high" })).toEqual({ defaultPriority: "high" });
    expect(settingsChanges(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS })).toEqual({});
  });
  it("submits provider and model together so a concurrent save cannot combine unrelated choices", () => {
    expect(settingsChanges(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, aiProvider: "openai" }))
      .toEqual({ aiProvider: "openai", aiModel: "" });
    expect(settingsChanges(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, aiModel: "custom-model" }))
      .toEqual({ aiProvider: "anthropic", aiModel: "custom-model" });
  });
});
