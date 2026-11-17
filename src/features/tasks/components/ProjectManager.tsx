"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n";
import type { Project } from "@/features/projects/schema";

interface Props {
  projects: Project[];
  t: Dictionary;
  onCreate: (name: string) => Promise<boolean>;
  onRename: (id: string, name: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export function ProjectManager({ projects, t, onCreate, onRename, onDelete }: Props) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(operation: () => Promise<boolean>) {
    setBusy(true);
    try { return await operation(); } finally { setBusy(false); }
  }
  return (
    <details className="card project-manager" aria-label={t.manageProjects}>
      <summary>{t.manageProjects}</summary>
      <fieldset disabled={busy}>
        <legend className="sr-only">{t.projects}</legend>
        <p>{t.projectDeleteHint}</p>
        <ul className="project-list">
          {projects.map((project) => (
            <li key={project.id}>
              {editing?.id === project.id ? (
                <form className="project-form" onSubmit={async (event) => {
                  event.preventDefault();
                  if (editing.name.trim() && await save(() => onRename(project.id, editing.name))) setEditing(null);
                }}>
                  <input value={editing.name} maxLength={80} aria-label={t.projectName} autoFocus
                    onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                    onKeyDown={(event) => { if (event.key === "Escape") setEditing(null); }} />
                  <button className="chip" type="submit" disabled={!editing.name.trim()}>{t.saveProject}</button>
                  <button className="chip" type="button" onClick={() => setEditing(null)}>{t.cancel}</button>
                </form>
              ) : (
                <>
                  <span>{project.name}</span>
                  <button className="chip" type="button" aria-label={t.renameProject(project.name)}
                    onClick={() => setEditing({ id: project.id, name: project.name })}>{t.edit}</button>
                  <button className="chip" type="button" aria-label={t.deleteProject(project.name)}
                    onClick={() => { void save(() => onDelete(project.id)); }}>×</button>
                </>
              )}
            </li>
          ))}
        </ul>
        <form className="project-form" onSubmit={async (event) => {
          event.preventDefault();
          if (draft.trim() && await save(() => onCreate(draft))) setDraft("");
        }}>
          <input value={draft} maxLength={80} aria-label={t.newProject} placeholder={t.newProject}
            onChange={(event) => setDraft(event.target.value)} />
          <button className="chip" type="submit" disabled={!draft.trim()}>{t.createProject}</button>
        </form>
      </fieldset>
    </details>
  );
}
