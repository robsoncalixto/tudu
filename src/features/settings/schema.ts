import { z } from "zod";
import { DEFAULT_LOCALE, LOCALES } from "@/i18n";
import { PRIORITIES } from "@/features/tasks/schema";
import { DATE_FORMATS } from "@/lib/dates";

const fields = {
  locale: z.enum(LOCALES),
  defaultPriority: z.enum(PRIORITIES),
  startView: z.enum(["all", "today"]),
  dateFormat: z.enum(DATE_FORMATS),
};
export const settingsSchema = z.object({
  locale: fields.locale.default(DEFAULT_LOCALE),
  defaultPriority: fields.defaultPriority.default("medium"),
  startView: fields.startView.default("all"),
  dateFormat: fields.dateFormat.default("locale"),
}).strict();
export const settingsPatchSchema = z.object(fields).partial().strict();
export type Settings = z.infer<typeof settingsSchema>;
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
export const DEFAULT_SETTINGS = settingsSchema.parse({});

export function settingsChanges(saved: Settings, draft: Settings): SettingsPatch {
  return settingsPatchSchema.parse(Object.fromEntries(
    Object.entries(draft).filter(([key, value]) => value !== saved[key as keyof Settings]),
  ));
}
