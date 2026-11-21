"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { shortcutsApi } from "@/features/shortcuts/api";
import type { Dictionary } from "@/i18n";
import { Icon } from "@/lib/Icon";
import { boardFilterForPage } from "../board-navigation";
import type { TaskFilter, TaskView } from "../selectors";
import { useSidebarLayout } from "../use-sidebar-layout";
import { NavProjectCreate } from "./NavProjectCreate";
import { ProjectManager, type ProjectManagerProps } from "./ProjectManager";
import { LoadFailure, NavGroup, NavItem } from "./SidebarItems";

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
  const [managing, setManaging] = useState(false);
  const [creating, setCreating] = useState(false);
  const { layout, compact, update, toggleGroup } = useSidebarLayout();
  const toggle = useRef<HTMLButtonElement>(null);
  const addProject = useRef<HTMLButtonElement>(null);
  function choose(next: TaskFilter) {
    if (expanded && (next.kind === "project" || next.kind === "tag")) toggle.current?.focus();
    setExpanded(false);
    onFilter(next);
  }
  function startProject() {
    projectManager.clearError();
    if (!layout.projects) update({ projects: true });
    setCreating(true);
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
            <button type="button" ref={addProject} className="nav-item nav-add-project" aria-label={t.newProject} title={t.newProject}
              aria-expanded={creating} aria-controls="nav-projects" onClick={startProject}><Icon name="plus" size={17} /></button>}>
          {creating && <NavProjectCreate t={t} error={projectManager.error} clearError={projectManager.clearError} onCreate={projectManager.onCreate}
            onClose={(settled) => {
              setCreating(false);
              projectManager.clearError();
              if (settled) addProject.current?.focus();
            }} />}
          {view.projectCounts.map(([project, count]) =>
            <NavItem key={project.id} label={project.name} count={count} active={active?.kind === "project" && active.id === project.id}
              ariaLabel={`${t.project}: ${project.name}, ${t.countOpen(count)}`} onClick={() => choose({ kind: "project", id: project.id })} />)}
          <button type="button" className="nav-item manage-projects" aria-haspopup="dialog"
            onClick={() => { projectManager.clearError(); setCreating(false); setManaging(true); }}>{t.manageProjects}</button>
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
      <button type="button" className="nav-item shortcut-help" aria-label={t.shortcuts.open} title={t.shortcuts.open}
        aria-haspopup="dialog" onClick={() => { setExpanded(false); shortcutsApi.run("help"); }}>
        <Icon name="keyboard" /><span>{t.shortcuts.open}</span>
      </button>
      {pageLink("/settings")}
    </div>
    <ProjectManager {...projectManager} error={creating ? "" : projectManager.error} t={t} open={managing} onClose={() => setManaging(false)} />
  </aside>;
}
