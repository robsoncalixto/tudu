import type { Dictionary, Locale } from "@/i18n";
import type { Project } from "@/features/projects/schema";
import { dueLabel } from "@/lib/dates";
import type { Proposal, ProposalAction } from "../schema";

export function ProposalValues({ action, proposal, projects, locale, t, before = false }: {
  action: ProposalAction; proposal: Proposal; projects: Project[]; locale: Locale; t: Dictionary; before?: boolean;
}) {
  if (action.kind === "create_project" || action.kind === "rename_project") return <p>{before ? proposal.projectBefore?.name : action.name}</p>;
  const fields = action.kind === "create_task" ? action.task : action.patch;
  const values = before && proposal.taskBefore ? proposal.taskBefore : fields;
  const date = (value: string | null | undefined) => value ? dueLabel(value, proposal.source.today, locale, t, "iso") : t.noDate;
  const pairs = [
    ["title", t.agentTaskTitle, values.title], ["notes", t.agentNotes, values.notes || t.agentEmpty],
    ["priority", t.priority, values.priority ? t[values.priority] : t.agentEmpty],
    ["due", t.setDate, date(values.due)], ["plannedFor", t.agentPlannedFor, date(values.plannedFor)],
    ["projectId", t.project, values.projectId ? projects.find((project) => project.id === values.projectId)?.name ?? t.agentMissingProject : t.noProject],
    ["tags", t.tags, values.tags?.join(", ") || t.agentEmpty],
  ];
  return <>
    <dl className="proposal-values">{pairs.filter(([key]) => key && key in fields).map(([key, label, value]) => <div key={key}>
      <dt>{label}</dt><dd>{value}</dd>
    </div>)}</dl>
    {"steps" in fields && <div><p className="section-title">{t.checklist}</p>
      {values.steps?.length ? <ul>{values.steps.map((step) => <li key={step.id}>{step.title} · {step.done ? t.agentStepStatuses.done : t.agentStepStatuses.open}</li>)}</ul> : <p>{t.agentEmpty}</p>}
    </div>}
  </>;
}
