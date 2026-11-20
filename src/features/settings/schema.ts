import { z } from "zod";
import { DEFAULT_LOCALE, LOCALES } from "@/i18n";
import { PRIORITIES } from "@/features/tasks/schema";
import { DATE_FORMATS } from "@/lib/dates";
import { aiModelSchema, aiProviderSchema } from "@/features/ai/schema";

export const THEMES = ["system", "light", "dark"] as const;

const timeZone = z.string().min(1).max(80).refine((zone) => {
  try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; }
  catch { return false; }
});

const automaticReview = z.object({
  enabled: z.boolean(),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  timeZone,
  enabledAt: z.iso.datetime().nullable().default(null),
}).strict();

const fields = {
  automaticReview,
  locale: z.enum(LOCALES),
  theme: z.enum(THEMES),
  defaultPriority: z.enum(PRIORITIES),
  startView: z.enum(["all", "today"]),
  dateFormat: z.enum(DATE_FORMATS),
  aiProvider: aiProviderSchema,
  aiModel: aiModelSchema,
};
export const settingsSchema = z.object({
  automaticReview: fields.automaticReview.default({ enabled: false, time: "09:00", timeZone: "UTC", enabledAt: null }),
  locale: fields.locale.default(DEFAULT_LOCALE),
  theme: fields.theme.default("system"),
  defaultPriority: fields.defaultPriority.default("medium"),
  startView: fields.startView.default("all"),
  dateFormat: fields.dateFormat.default("locale"),
  aiProvider: fields.aiProvider.default("anthropic"),
  aiModel: fields.aiModel.default(""),
}).strict();
export const settingsPatchSchema = z.object(fields).partial().strict();
export type Settings = z.infer<typeof settingsSchema>;
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
export const DEFAULT_SETTINGS = settingsSchema.parse({});

export function settingsChanges(saved: Settings, draft: Settings): SettingsPatch {
  const changed = Object.fromEntries(
    Object.entries(draft).filter(([key, value]) => value !== saved[key as keyof Settings]),
  );
  if (saved.aiProvider !== draft.aiProvider || saved.aiModel !== draft.aiModel) {
    changed.aiProvider = draft.aiProvider;
    changed.aiModel = draft.aiModel;
  }
  return settingsPatchSchema.parse(changed);
}
