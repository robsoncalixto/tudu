import type { Dictionary, Locale } from "@/i18n";

export function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parse(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function dayDiff(iso: string, today: string): number {
  return Math.round((parse(iso).getTime() - parse(today).getTime()) / 86_400_000);
}

export function dueLabel(iso: string, today: string, locale: Locale, t: Dictionary): string {
  const diff = dayDiff(iso, today);
  if (diff === 0) return t.today;
  if (diff === 1) return t.tomorrow;
  if (diff === -1) return t.yesterday;
  const date = parse(iso);
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== parse(today).getFullYear() ? { year: "numeric" } : {}),
  }).format(date);
}

export function longDate(today: string, locale: Locale): { weekday: string; rest: string } {
  const date = parse(today);
  return {
    weekday: new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date),
    rest: new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(date),
  };
}
