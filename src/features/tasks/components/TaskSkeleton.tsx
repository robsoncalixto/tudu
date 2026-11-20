import type { Project } from "@/features/projects/schema";
import type { Dictionary, Locale } from "@/i18n";
import type { DateFormat } from "@/lib/dates";
import { ComposerChips } from "./ComposerChips";

interface Props {
  t: Dictionary;
  locale: Locale;
  dateFormat: DateFormat;
  projects: Project[];
}

const EMPTY = { batch: false, priority: null, due: null, time: null, partOfDay: null, plannedFor: null, projectId: null, tags: [], estimateHours: null, repeat: null };
const nothing = () => {};

/** Stands in for the task field and the list while they load, in their sizes, so nothing jumps when they arrive. */
export function TaskSkeleton({ t, locale, dateFormat, projects }: Props) {
  return <div className="task-skeleton" aria-hidden="true" inert>
    <div className="skeleton-entry" />
    {/* The chips wrap by their labels, so the real ones, out of reach, are what holds their place. */}
    <ComposerChips t={t} locale={locale} dateFormat={dateFormat} today="" values={EMPTY} projects={projects} savedTags={[]} disabled
      onPriority={nothing} onDue={nothing} onPartOfDay={nothing} onPlanned={nothing} onProject={nothing} onEstimate={nothing} onRepeat={nothing}
      onAddTag={nothing} onRemoveTag={nothing} />
    <div className="skeleton-options" />
    <div className="skeleton-toolbar"><span /><span /></div>
    <div className="skeleton-list">
      <div className="skeleton-head" />
      {[72, 48, 64, 40].map((width) => <div className="skeleton-row" key={width}>
        <span /><span style={{ width: `${width}%` }} /><span /><span />
      </div>)}
    </div>
  </div>;
}
