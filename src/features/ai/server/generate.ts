import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import OpenAI from "openai";
import { zodResponseFormat, zodTextFormat } from "openai/helpers/zod";
import type { Settings } from "@/features/settings/schema";
import { AiError, type GenerateStructured } from "../schema";
import { aiPublicConfiguration } from "./configuration";

export function createGenerator(settings: Pick<Settings, "aiProvider" | "aiModel">, env: Readonly<Record<string, string | undefined>> = process.env): GenerateStructured {
  const config = aiPublicConfiguration(env);
  const provider = settings.aiProvider;
  const model = settings.aiModel || config.models[provider];
  return async ({ schema, name, system, input, maxTokens }) => {
    if (!config.available[provider]) throw new AiError("ai_disabled");
    try {
      let output: unknown;
      if (provider === "anthropic") {
        const apiKey = env.ANTHROPIC_API_KEY?.trim() || null;
        const response = await new Anthropic({
          apiKey, authToken: apiKey ? null : env.ANTHROPIC_AUTH_TOKEN?.trim() || null,
          timeout: 60_000, maxRetries: 0,
        }).messages.parse({
          model, max_tokens: maxTokens, system, messages: [{ role: "user", content: input }],
          output_config: { format: zodOutputFormat(schema) },
        });
        if (response.stop_reason === "refusal") throw new AiError("ai_refused");
        if (response.stop_reason !== "end_turn") throw new AiError("ai_failed");
        output = response.parsed_output;
      } else {
        const client = new OpenAI({
          apiKey: (provider === "openai" ? env.OPENAI_API_KEY : env.OPENROUTER_API_KEY)?.trim(),
          baseURL: provider === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1",
          timeout: 60_000, maxRetries: 0,
        });
        if (provider === "openai") {
          const response = await client.responses.parse({
            model, instructions: system, input, max_output_tokens: maxTokens, store: false,
            text: { format: zodTextFormat(schema, name) },
          });
          if (response.output.some((item) => item.type === "message" && item.content.some((content) => content.type === "refusal"))) throw new AiError("ai_refused");
          if (response.status !== "completed") throw new AiError("ai_failed");
          output = response.output_parsed;
        } else {
          const request = {
            model, max_completion_tokens: maxTokens,
            messages: [{ role: "system" as const, content: system }, { role: "user" as const, content: input }],
            response_format: zodResponseFormat(schema, name), provider: { require_parameters: true },
          };
          const response = await client.chat.completions.parse(request);
          const choice = response.choices[0];
          if (choice?.message.refusal) throw new AiError("ai_refused");
          if (choice?.finish_reason !== "stop") throw new AiError("ai_failed");
          output = choice.message.parsed;
        }
      }
      const parsed = schema.safeParse(output);
      if (!parsed.success) throw new AiError("ai_failed");
      return parsed.data;
    } catch (error) {
      if (error instanceof AiError) throw error;
      const status = error instanceof Anthropic.APIError || error instanceof OpenAI.APIError ? error.status : undefined;
      throw new AiError(status === 401 || status === 403 ? "ai_auth" : status === 429 ? "ai_busy" : "ai_failed");
    }
  };
}
