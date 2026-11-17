import { en, type Dictionary } from "./locales/en";
import { ptBR } from "./locales/pt-BR";

export type { Dictionary };

export const LOCALES = ["en", "pt-BR"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const dictionaries: Record<Locale, Dictionary> = { en, "pt-BR": ptBR };

export type ErrorCode = keyof Dictionary["errors"];

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function errorMessage(t: Dictionary, code: string): string {
  return code in t.errors ? t.errors[code as ErrorCode] : t.errors.generic;
}
