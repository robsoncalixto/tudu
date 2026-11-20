import type { Project } from "@/features/projects/schema";
import type { QuickTask } from "@/features/quick-add/schema";
import type { Dictionary, Locale } from "@/i18n";
import { dueLabel, type DateFormat } from "@/lib/dates";
import { Icon } from "@/lib/Icon";
import { durationLabel } from "../duration";

interface Props {
  /** One task per line, or null while a line cannot be saved yet. */
  drafts: QuickTask[] | null;
  count: number;
  today: string;
  locale: Locale;
  dateFormat: DateFormat;
  projects: Project[];
  t: Dictionary;
  disabled: boolean;
  onJoin: () => void;
}

/** Shown when several lines are typed or pasted: what each line becomes, with the choice to keep them as one task. */
export function ComposerBatch({ drafts, count, today, locale, dateFormat, projects, t, disabled, onJoin }: Props) {
  return <section className="composer-batch" aria-label={t.quickTaskPreview}>
    <header>
      <p id="quick-task-batch">{t.composerBatch(count)}</p>
      <button type="submit" className="chip" disabled={disabled}>{t.composerAddAll(count)}</button>
      <button type="button" className="chip" disabled={disabled} onClick={onJoin}>{t.composerJoin}</button>
    </header>
    {drafts && <ul className="quick-preview" aria-labelledby="quick-task-batch">
      {drafts.map((draft, index) => {
        const project = projects.find((item) => item.id === draft.projectId);
        return <li className="quick-task-line" key={index}>
          <span className="quick-task-title">{draft.title}</span>
          {draft.due && <span className="quick-metadata"><Icon name="calendar" size={14} /><span className="sr-only">{t.setDate} </span>{dueLabel(draft.due, today, locale, t, dateFormat)}</span>}
          {draft.priority && <span className="quick-metadata"><Icon name="flag" size={14} /><span className="sr-only">{t.priority} </span>{t[draft.priority]}</span>}
          {project && <span className="quick-metadata"><Icon name="folder" size={14} />{project.name}</span>}
          {draft.estimateHours != null && <span className="quick-metadata"><Icon name="clock" size={14} /><span className="sr-only">{t.taskResources.estimate} </span>{durationLabel(draft.estimateHours, locale)}</span>}
          {draft.tags.map((tag) => <span className="quick-metadata" key={tag}>#{tag}</span>)}
        </li>;
      })}
    </ul>}
  </section>;
}
