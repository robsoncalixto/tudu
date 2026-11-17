import type { Dictionary } from "@/i18n";
import type { TaskFilter, TaskView } from "../selectors";

interface Props {
  t: Dictionary;
  openCount: number;
  todayCount: number;
  tagCounts: TaskView["tagCounts"];
  projectCounts: TaskView["projectCounts"];
  filter: TaskFilter;
  onFilter: (filter: TaskFilter) => void;
  onShortcuts: () => void;
}

export function Sidebar({ t, openCount, todayCount, tagCounts, projectCounts, filter, onFilter, onShortcuts }: Props) {
  const tagFilter = filter.kind === "tag" ? filter.tag : null;
  // A tag stays listed while it is the active filter, even with no open tasks left.
  const tags =
    tagFilter && !tagCounts.some(([tag]) => tag === tagFilter)
      ? [[tagFilter, 0] as [string, number], ...tagCounts]
      : tagCounts;

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-name">TUDU</span>
      </div>

      <nav className="nav" aria-label={t.taskViews}>
        <NavItem
          label={t.allTasks} count={openCount} active={filter.kind === "all"}
          onClick={() => onFilter({ kind: "all" })}
        />
        <NavItem
          label={t.today} count={todayCount} active={filter.kind === "today"}
          onClick={() => onFilter({ kind: "today" })}
        />
        <a href="/work-log" className="nav-item nav-link">{t.workLog}</a>
        {projectCounts.length > 0 && <p className="nav-label">{t.projects}</p>}
        {projectCounts.map(([project, count]) => (
          <NavItem key={project.id} label={project.name} count={count} ariaLabel={`${t.project}: ${project.name}, ${t.countOpen(count)}`}
            active={filter.kind === "project" && filter.id === project.id}
            onClick={() => onFilter({ kind: "project", id: project.id })} />
        ))}
        {tags.length > 0 && <p className="nav-label">{t.tags}</p>}
        {tags.map(([tag, count]) => (
          <NavItem
            key={tag} label={`#${tag}`} count={count} active={tagFilter === tag}
            onClick={() => onFilter({ kind: "tag", tag })}
          />
        ))}
      </nav>

      <div className="sidebar-actions">
        <a href="/settings" className="nav-item nav-link">{t.settings}</a>
        <button type="button" className="nav-item shortcut-help" aria-label={t.keyboardShortcuts} title={t.keyboardShortcuts} onClick={onShortcuts}>?</button>
      </div>
    </aside>
  );
}

function NavItem(props: { label: string; count: number; active: boolean; onClick: () => void; ariaLabel?: string }) {
  return (
    <button
      type="button"
      className={`nav-item${props.active ? " is-active" : ""}`}
      aria-current={props.active ? "page" : undefined}
      aria-label={props.ariaLabel}
      onClick={props.onClick}
    >
      <span>{props.label}</span>
      <span className="nav-count">{props.count}</span>
    </button>
  );
}
