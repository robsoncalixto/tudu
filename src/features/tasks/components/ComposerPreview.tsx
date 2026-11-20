import type { Project } from "@/features/projects/schema";
import type { QuickTask } from "@/features/quick-add/schema";
import type { Dictionary, Locale } from "@/i18n";
import { dueLabel, type DateFormat } from "@/lib/dates";
import { Icon } from "@/lib/Icon";
import { HOURS_PER_UNIT, type DurationUnit } from "../schema";

export type PreviewDraft = Pick<QuickTask, "title" | "priority" | "due" | "projectId" | "tags" | "estimateHours">;

function estimateLabel(hours: number, locale: Locale) {
  const unit: DurationUnit = hours < 1 ? "minutes" : hours % HOURS_PER_UNIT.days === 0 ? "days" : "hours";
  const displayUnit = { minutes: "minute", hours: "hour", days: "day" }[unit];
  return new Intl.NumberFormat(locale, { style: "unit", unit: displayUnit, unitDisplay: "long", maximumSignificantDigits: 12 })
    .format(hours / HOURS_PER_UNIT[unit]);
}

export function ComposerPreview({ drafts, today, locale, dateFormat, projects, fixedTag, t, onRemoveTag }: {
  drafts: PreviewDraft[]; today: string; locale: Locale; dateFormat: DateFormat; projects: Project[];
  fixedTag?: string; t: Dictionary; onRemoveTag: (tag: string) => void;
}) {
  if (!drafts.length) return null;
  return <ul className="quick-preview" id="quick-task-preview" aria-label={t.quickTaskPreview}>
    {drafts.map((draft, index) => {
      const project = projects.find((item) => item.id === draft.projectId);
      return <li className="quick-task-line" key={index}>
        {drafts.length > 1 && <span className="quick-task-title">{draft.title}</span>}
        {draft.due && <span className="quick-metadata"><Icon name="calendar" size={14} /><span className="sr-only">{t.setDate} </span>{dueLabel(draft.due, today, locale, t, dateFormat)}</span>}
        {draft.priority && <span className="quick-metadata"><Icon name="flag" size={14} /><span className="sr-only">{t.priority} </span>{t[draft.priority]}</span>}
        {project && <span className="quick-metadata"><Icon name="folder" size={14} />{project.name}</span>}
        {draft.estimateHours != null && <span className="quick-metadata"><Icon name="clock" size={14} /><span className="sr-only">{t.taskResources.estimate} </span>{estimateLabel(draft.estimateHours, locale)}</span>}
        {draft.tags.map((tag) => tag === fixedTag
          ? <span className="quick-metadata" key={tag}>#{tag}</span>
          : <button type="button" className="quick-metadata" key={tag} aria-label={t.composerRemoveTag(tag)}
              onClick={() => onRemoveTag(tag)}>#{tag}<Icon name="x" size={13} /></button>)}
      </li>;
    })}
  </ul>;
}
