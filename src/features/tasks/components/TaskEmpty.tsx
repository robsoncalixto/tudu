import type { Dictionary } from "@/i18n";
import { Icon } from "@/lib/Icon";
import type { TaskFilter } from "../selectors";

export function TaskEmpty({ filter, searching, t, onAction }: {
  filter: TaskFilter; searching: boolean; t: Dictionary; onAction: () => void;
}) {
  const title = searching ? t.emptySearch : { all: t.emptyTitle, today: t.emptyToday, tag: t.emptyFiltered, project: t.emptyProject }[filter.kind];
  const detail = searching ? t.emptySearchHint : filter.kind === "today" ? t.emptyTodayBody : filter.kind === "all" ? t.emptyBody : "";
  return <div className="task-empty">
    {searching ? <Icon name="search" size={36} /> :
      <svg className="empty-pages" aria-hidden="true" width="92" height="76" viewBox="0 0 92 76" fill="none">
        <g strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="15" y="13" width="42" height="49" rx="5" transform="rotate(-12 36 38)" fill="var(--surface-muted)" stroke="var(--control-border)" />
          <rect x="32" y="12" width="43" height="51" rx="5" transform="rotate(6 53 38)" fill="var(--surface)" stroke="currentColor" />
          <g transform="rotate(6 53 38)" stroke="currentColor">
            <path d="m40 25 2.5 2.5 4-5M52 25h15" /><rect x="40" y="35" width="6" height="6" rx="1.5" />
            <path d="M52 38h12" /><rect x="40" y="47" width="6" height="6" rx="1.5" /><path d="M52 50h9" />
          </g>
        </g>
      </svg>}
    <h3>{title}</h3>{detail && <p>{detail}</p>}
    <button type="button" className="empty-action" onClick={onAction}>
      <Icon name={searching ? "x" : "plus"} size={15} />{searching ? t.clearSearch : t.addTask}
    </button>
  </div>;
}
