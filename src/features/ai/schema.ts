import { z } from "zod";

export const AI_PROVIDERS = ["anthropic", "openai", "openrouter"] as const;
export const aiProviderSchema = z.enum(AI_PROVIDERS);
export type AiProvider = z.infer<typeof aiProviderSchema>;
export const aiModelSchema = z.string().trim().max(160).regex(/^[A-Za-z0-9_./:-]*$/);
export const aiPublicConfigurationSchema = z.object({
  available: z.record(aiProviderSchema, z.boolean()),
  models: z.record(aiProviderSchema, aiModelSchema),
});
export type AiPublicConfiguration = z.infer<typeof aiPublicConfigurationSchema>;
export type GenerateStructured = <S extends z.ZodType>(request: {
  schema: S; name: string; system: string; input: string; maxTokens: number;
}) => Promise<z.output<S>>;
const aiErrorCodeSchema = z.enum(["ai_disabled", "ai_auth", "ai_busy", "ai_failed", "ai_refused"]);
export class AiError extends Error {
  constructor(public readonly code: z.infer<typeof aiErrorCodeSchema>) { super(code); }
}
