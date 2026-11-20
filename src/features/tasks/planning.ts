export type Postponement = "tomorrow" | "next-week";

export function postponementDate(today: string, when: Postponement): string {
  const date = new Date(`${today}T00:00:00Z`);
  const days = when === "tomorrow" ? 1 : (8 - date.getUTCDay()) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
