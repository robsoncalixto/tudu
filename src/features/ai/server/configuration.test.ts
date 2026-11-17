import { describe, expect, it } from "vitest";
import { aiPublicConfiguration } from "./configuration";

describe("AI public configuration", () => {
  it("preserves Anthropic defaults and reports no providers configured for an empty environment", () => {
    expect(aiPublicConfiguration({})).toEqual({
      available: { anthropic: false, openai: false, openrouter: false },
      models: { anthropic: "claude-opus-5-5", openai: "gpt-6.2-sol", openrouter: "anthropic/claude-opus-5.5" },
    });
  });
  it("exposes only availability and model names, never server credentials", () => {
    const config = aiPublicConfiguration({
      ANTHROPIC_AUTH_TOKEN: "private-anthropic", OPENAI_API_KEY: "private-openai", OPENROUTER_API_KEY: "private-openrouter",
      TUDU_AI_MODEL: "legacy-model", TUDU_OPENAI_MODEL: "openai-model", TUDU_OPENROUTER_MODEL: "custom/model",
    });
    expect(config.available).toEqual({ anthropic: true, openai: true, openrouter: true });
    expect(config.models).toEqual({ anthropic: "legacy-model", openai: "openai-model", openrouter: "custom/model" });
    expect(JSON.stringify(config)).not.toContain("private");
  });
  it("ignores whitespace credentials and uses defaults for blank model overrides", () => {
    expect(aiPublicConfiguration({ OPENAI_API_KEY: "  ", TUDU_OPENAI_MODEL: "  " })).toEqual(aiPublicConfiguration({}));
  });
});
