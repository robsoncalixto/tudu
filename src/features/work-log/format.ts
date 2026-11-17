import type { Dictionary } from "@/i18n";
import type { WorkLogGroup } from "./schema";

export function groupLabel(group: WorkLogGroup, t: Dictionary): string | null {
  if (group.kind === "none") return null;
  return group.label ?? (group.kind === "project" ? t.noProject : t.noTags);
}

function line(text: string): string { return text.replace(/\s+/g, " ").trim(); }
function markdown(text: string): string { return line(text).replace(/[\\`*_{}\[\]<>#+.!|~-]/g, "\\$&"); }

export function formatWorkLog(day: string, groups: WorkLogGroup[], mode: "text" | "markdown", t: Dictionary, summary = ""): string {
  const escape = mode === "markdown" ? markdown : line;
  const result = [`${mode === "markdown" ? "# " : ""}${t.workLog} — ${day}`];
  if (summary) result.push(escape(summary));
  for (const group of groups) {
    const label = groupLabel(group, t);
    result.push([
      ...(label ? [`${mode === "markdown" ? "## " : ""}${escape(label)}`] : []),
      ...group.tasks.map((task) => `- ${escape(task.title)}`),
    ].join("\n"));
  }
  return result.join("\n\n");
}
