import type { AiProvider, AiPublicConfiguration } from "../schema";

const DEFAULT_MODELS = {
  anthropic: "claude-opus-5-5", openai: "gpt-6.2-sol", openrouter: "anthropic/claude-opus-5.5",
} satisfies Record<AiProvider, string>;

export function aiPublicConfiguration(env: Readonly<Record<string, string | undefined>> = process.env): AiPublicConfiguration {
  return {
    available: {
      anthropic: Boolean(env.ANTHROPIC_API_KEY?.trim() || env.ANTHROPIC_AUTH_TOKEN?.trim()),
      openai: Boolean(env.OPENAI_API_KEY?.trim()), openrouter: Boolean(env.OPENROUTER_API_KEY?.trim()),
    },
    models: {
      anthropic: env.TUDU_AI_MODEL?.trim() || DEFAULT_MODELS.anthropic,
      openai: env.TUDU_OPENAI_MODEL?.trim() || DEFAULT_MODELS.openai,
      openrouter: env.TUDU_OPENROUTER_MODEL?.trim() || DEFAULT_MODELS.openrouter,
    },
  };
}
