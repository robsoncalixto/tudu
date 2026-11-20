import { z } from "zod";

export const repeatRuleSchema = z.discriminatedUnion("frequency", [
  z.object({ frequency: z.literal("daily") }),
  z.object({ frequency: z.literal("weekdays") }),
  z.object({
    frequency: z.literal("weekly"),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7)
      .refine((days) => new Set(days).size === days.length)
      .overwrite((days) => [...days].sort((a, b) => a - b)),
  }),
  z.object({ frequency: z.literal("monthly"), day: z.number().int().min(1).max(31) }),
]);

export type RepeatRule = z.infer<typeof repeatRuleSchema>;
export type RepeatFrequency = RepeatRule["frequency"];
export const REPEAT_FREQUENCIES = ["daily", "weekdays", "weekly", "monthly"] as const satisfies readonly RepeatFrequency[];

/** The plain rule of a frequency for a task due on `date`: weekly on that weekday, monthly on that day. */
export function repeatFrom(frequency: RepeatFrequency, date: string): RepeatRule {
  const day = new Date(`${date}T12:00:00Z`);
  if (frequency === "weekly") return { frequency, days: [day.getUTCDay()] };
  if (frequency === "monthly") return { frequency, day: day.getUTCDate() };
  return { frequency };
}
