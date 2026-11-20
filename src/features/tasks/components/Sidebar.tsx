"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import type { Dictionary } from "@/i18n";
import { Icon, type IconName } from "@/lib/Icon";
import { boardFilterForPage } from "../board-navigation";
import type { TaskFilter, TaskView } from "../selectors";
import { useSidebarLayout } from "../use-sidebar-layout";
import { ProjectManager, type ProjectDialogMode, type ProjectManagerProps } from "./ProjectManager";

interface Props {
  t: Dictionary;
  view: TaskView;
  filter: TaskFilter;
  projectManager: Omit<ProjectManagerProps, "t">;
  onFilter: (filter: TaskFilter) => void;
  page: string;
  pendingCount: number;
  taskLoadFailed: boolean;
  projectLoadFailed: boolean;
  onRetryTasks: () => void;
  onRetryProjects: () => void;
}

export function Sidebar({ t, view, filter, projectManager, onFilter, page, pendingCount, taskLoadFailed, projectLoadFailed, onRetryTasks, onRetryProjects }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [projectDialog, setProjectDialog] = useState<ProjectDialogMode | null>(null);
  const { layout, compact, update, toggleGroup } = useSidebarLayout();
  const toggle = useRef<HTMLButtonElement>(null);
  function choose(next: TaskFilter) {
    if (expanded && (next.kind === "project" || next.kind === "tag")) toggle.current?.focus();
    setExpanded(false);
    onFilter(next);
  }
  function openProjects(mode: ProjectDialogMode) {
    projectManager.clearError();
    if (mode === "create" && !layout.projects) update({ projects: true });
    setProjectDialog(mode);
  }
  const active = boardFilterForPage(page, filter);
  const tagFilter = active?.kind === "tag" ? active.tag : null;
  const projectName = active?.kind === "project" ? projectManager.projects.find((project) => project.id === active.id)?.name : undefined;
  const tags = tagFilter && !view.tagCounts.some(([tag]) => tag === tagFilter)
    ? [[tagFilter, 0] as [string, number], ...view.tagCounts] : view.tagCounts;
  const links = { "/work-log": [t.workLog, "book"], "/agent": [t.agent, "assistant"], "/settings": [t.settings, "settings"] } as const;
  function pageLink(href: keyof typeof links) {
    const [label, icon] = links[href];
    return <Link href={href} className={`nav-item${page === href ? " is-active" : ""}`}
      aria-current={page === href ? "page" : undefined} aria-label={label}
      aria-description={href === "/agent" && pendingCount ? t.pendingAgentCount(pendingCount) : undefined} title={label} onClick={() => {
        if (expanded && href !== "/settings") toggle.current?.focus();
        setExpanded(false);
      }}>
      <Icon name={icon} /><span>{label}</span>
      {href === "/agent" && pendingCount > 0 && <span className="nav-count">{pendingCount}</span>}
    </Link>;
  }
  const sizeLabel = compact ? t.expandSidebar : t.collapseSidebar;
  return <aside className={`sidebar${expanded ? " is-expanded" : ""}${compact ? " is-compact" : ""}`}
    onBlur={(event) => {
      if (expanded && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setExpanded(false);
    }}
    onKeyDown={(event) => {
      if (expanded && event.key === "Escape" && event.target instanceof Element && !event.target.closest("dialog")) {
        event.preventDefault(); event.stopPropagation(); setExpanded(false); toggle.current?.focus();
      }
    }}>
    <div className="sidebar-heading">
      <img className="sidebar-brand" alt={t.brandName} width={compact ? 30 : 114} height={30}
        src={compact ? "/brand/tudu-icon.svg" : "/brand/tudu-logo-on-dark.svg"} />
      <button type="button" className="nav-item sidebar-width" aria-label={sizeLabel} title={sizeLabel}
        aria-expanded={!compact} aria-controls="task-navigation" onClick={() => update({ compact: !compact })}>
        <Icon name="chevron-right" size={17} />
      </button>
    </div>
    <button type="button" ref={toggle} className="nav-item more-views" aria-label={t.moreViews}
      aria-controls="nav-library" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
      <Icon name={expanded ? "x" : "menu"} />
    </button>
    <nav className="nav" id="task-navigation" aria-label={t.taskViews}>
      <p className="nav-label">{t.workspace}</p>
      <NavItem label={t.allTasks} icon="list-checks" count={view.openCount} active={active?.kind === "all"}
        ariaLabel={`${t.allTasks}, ${t.countOpen(view.openCount)}`} onClick={() => choose({ kind: "all" })} />
      <NavItem label={t.today} icon="sun" count={view.todayCount} active={active?.kind === "today"}
        ariaLabel={`${t.today}, ${t.countOpen(view.todayCount)}`} onClick={() => choose({ kind: "today" })} />
      {(taskLoadFailed || projectLoadFailed) && <div className="sidebar-failures">
        {taskLoadFailed && <LoadFailure message={t.taskLoadFailed} retry={t.retry} onRetry={onRetryTasks} />}
        {projectLoadFailed && <LoadFailure message={t.projectLoadFailed} retry={t.retry} onRetry={onRetryProjects} />}
      </div>}
      <div id="nav-library" className="nav-library">
        <div className="nav-tools">
          {pageLink("/work-log")}
          {pageLink("/agent")}
        </div>
        <NavGroup name="projects" label={t.projects} icon="folder" open={layout.projects && !compact}
          currentLabel={projectName} onToggle={() => toggleGroup("projects")} action={
            <button type="button" className="nav-item nav-add-project" aria-label={t.newProject} title={t.newProject}
              aria-haspopup="dialog" onClick={() => openProjects("create")}><Icon name="plus" size={17} /></button>}>
          {view.projectCounts.map(([project, count]) =>
            <NavItem key={project.id} label={project.name} count={count} active={active?.kind === "project" && active.id === project.id}
              ariaLabel={`${t.project}: ${project.name}, ${t.countOpen(count)}`} onClick={() => choose({ kind: "project", id: project.id })} />)}
          <button type="button" className="nav-item manage-projects" aria-haspopup="dialog"
            onClick={() => openProjects("manage")}>{t.manageProjects}</button>
        </NavGroup>
        {tags.length > 0 && <NavGroup name="tags" label={t.tags} icon="tag" open={layout.tags && !compact}
          currentLabel={tagFilter ? `#${tagFilter}` : undefined} onToggle={() => toggleGroup("tags")}>
          {tags.map(([tag, count]) =>
            <NavItem key={tag} label={`#${tag}`} count={count} active={tagFilter === tag}
              ariaLabel={`#${tag}, ${t.countOpen(count)}`} onClick={() => choose({ kind: "tag", tag })} />)}
        </NavGroup>}
      </div>
    </nav>
    <div className="sidebar-actions">
      {pageLink("/settings")}
    </div>
    <ProjectManager {...projectManager} t={t} mode={projectDialog} onClose={() => setProjectDialog(null)} />
  </aside>;
}

function NavGroup({ name, label, icon, open, currentLabel, onToggle, action, children }: {
  name: string; label: string; icon: IconName; open: boolean; currentLabel?: string; onToggle: () => void; action?: ReactNode; children: ReactNode;
}) {
  const hiddenSelection = open ? undefined : currentLabel;
  return <div className="nav-group">
    <div className="nav-group-header">
      <button type="button" className={`nav-item nav-group-toggle${hiddenSelection ? " is-active" : ""}`}
        aria-label={label} aria-current={hiddenSelection ? "true" : undefined} aria-description={hiddenSelection}
        title={hiddenSelection ? `${label} · ${hiddenSelection}` : label} aria-expanded={open} aria-controls={`nav-${name}`} onClick={onToggle}>
        <Icon name={icon} /><span>{label}</span><Icon name="chevron-right" size={14} className="nav-disclosure" />
      </button>
      {action}
    </div>
    <div id={`nav-${name}`} className="nav-group-items" hidden={!open}>{children}</div>
  </div>;
}

function NavItem({ label, icon, count, active, onClick, ariaLabel }: {
  label: string; icon?: IconName; count: number; active: boolean; onClick: () => void; ariaLabel: string;
}) {
  return <button type="button" className={`nav-item${active ? " is-active" : ""}`}
    aria-current={active ? "page" : undefined} aria-label={ariaLabel} title={label} onClick={onClick}>
    {icon && <Icon name={icon} />}<span className="nav-text">{label}</span><span className="nav-count">{count}</span>
  </button>;
}

function LoadFailure({ message, retry, onRetry }: { message: string; retry: string; onRetry: () => void }) {
  return <div>
    <p role="alert">{message}</p>
    <button type="button" className="nav-item" aria-label={`${retry} · ${message}`} onClick={onRetry}>
      <span>{retry}</span>
    </button>
  </div>;
}
