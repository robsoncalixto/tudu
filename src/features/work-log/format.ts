import type { Dictionary, Locale } from "@/i18n";
import type { Task } from "@/features/tasks/schema";
import { totalWorkLogTime, type WorkLogTime } from "./selectors";
import type { WorkLogGroup } from "./schema";

export function groupLabel(group: WorkLogGroup, t: Dictionary): string | null {
  if (group.kind === "none") return null;
  return group.label ?? (group.kind === "project" ? t.noProject : t.noTags);
}

function line(text: string): string { return text.replace(/\s+/g, " ").trim(); }
function markdown(text: string): string { return line(text).replace(/[\\`*_{}\[\]<>#+.!|~-]/g, "\\$&"); }

function formatHours(hours: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { style: "unit", unit: "hour", maximumSignificantDigits: 12 }).format(hours);
}

export function taskTimeLabel(task: Task, t: Dictionary, locale: Locale): string | null {
  if (task.realTimeHours === null) return null;
  const spent = t.workLogSpent(formatHours(task.realTimeHours, locale));
  if (task.estimateHours === null) return spent;
  return `${spent} · ${t.workLogEstimate(formatHours(task.estimateHours, locale))}`;
}

export function totalTimeLabel(total: WorkLogTime, t: Dictionary, locale: Locale): string {
  const time = t.workLogTotalTime(formatHours(total.hours, locale));
  return total.missing ? `${time} (${t.workLogMissingTime(total.missing)})` : time;
}

export function formatWorkLog(day: string, groups: WorkLogGroup[], mode: "text" | "markdown", t: Dictionary, locale: Locale, summary = ""): string {
  const escape = mode === "markdown" ? markdown : line;
  const result = [`${mode === "markdown" ? "# " : ""}${t.workLog} — ${day}`];
  if (summary) result.push(escape(summary));
  result.push(totalTimeLabel(totalWorkLogTime(groups.flatMap((group) => group.tasks)), t, locale));
  for (const group of groups) {
    const label = groupLabel(group, t);
    result.push([
      ...(label ? [`${mode === "markdown" ? "## " : ""}${escape(label)}`] : []),
      ...group.tasks.map((task) => {
        const time = taskTimeLabel(task, t, locale);
        return `- ${escape(task.title)}${time ? ` — ${time}` : ""}`;
      }),
      ...(label ? ["", totalTimeLabel(totalWorkLogTime(group.tasks), t, locale)] : []),
    ].join("\n"));
  }
  return result.join("\n\n");
}
