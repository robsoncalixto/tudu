"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@/lib/Icon";
import type { Dictionary } from "@/i18n";
import type { Project } from "@/features/projects/schema";

export interface ProjectManagerProps {
  projects: Project[];
  error: string;
  clearError: () => void;
  t: Dictionary;
  onCreate: (name: string) => Promise<boolean>;
  onRename: (id: string, name: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export type ProjectDialogMode = "create" | "manage";

export function ProjectManager({ projects, t, error, clearError, onCreate, onRename, onDelete, mode, onClose }:
  ProjectManagerProps & { mode: ProjectDialogMode | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const newName = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useLayoutEffect(() => {
    if (mode && !dialog.current?.open) {
      dialog.current?.showModal();
      if (mode === "create") newName.current?.focus();
    }
  }, [mode]);
  async function save(operation: () => Promise<boolean>) {
    clearError();
    setBusy(true);
    try { return await operation(); } finally { setBusy(false); }
  }
  function finishRename(id: string) {
    setEditing(null);
    requestAnimationFrame(() => {
      if (dialog.current?.open && (document.activeElement === document.body || document.activeElement === dialog.current)) {
        dialog.current.querySelector<HTMLButtonElement>(`[data-rename-project="${id}"]`)?.focus();
      }
    });
  }
  return (
    <dialog ref={dialog} className="card project-manager" aria-labelledby="project-manager-title"
      onCancel={(event) => { if (busy) event.preventDefault(); }} onClose={() => { clearError(); setEditing(null); onClose(); }}>
      <header><h2 id="project-manager-title">{mode === "create" ? t.newProject : t.manageProjects}</h2>
        <button type="button" disabled={busy} className="icon-btn project-icon" title={t.close} aria-label={t.close} onClick={() => dialog.current?.close()}>
          <Icon name="x" />
        </button>
      </header>
      <fieldset disabled={busy}>
        <legend className="sr-only">{t.projects}</legend>
        {mode === "manage" && <>
          <p>{t.projectDeleteHint}</p>
          <ul className="project-list">
            {projects.map((project) => (
              <li key={project.id}>
                {editing?.id === project.id ? (
                  <form className="project-form" onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      finishRename(project.id);
                    }
                  }} onSubmit={async (event) => {
                    event.preventDefault();
                    if (editing.name.trim() && await save(() => onRename(project.id, editing.name))) finishRename(project.id);
                  }}>
                    <label className="project-name-field">{t.projectName}
                      <input className="form-control" value={editing.name} maxLength={80} autoFocus
                        onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
                    </label>
                    <button className="btn btn-primary" type="submit" disabled={!editing.name.trim()}>{t.saveProject}</button>
                    <button className="btn btn-secondary" type="button" onClick={() => finishRename(project.id)}>{t.cancel}</button>
                  </form>
                ) : (
                  <>
                    <span>{project.name}</span>
                    <button className="btn btn-secondary" type="button" data-rename-project={project.id} aria-label={t.renameProject(project.name)}
                      onClick={() => setEditing({ id: project.id, name: project.name })}>{t.edit}</button>
                    <button className="icon-btn project-icon project-delete" type="button" title={t.deleteProject(project.name)} aria-label={t.deleteProject(project.name)}
                      onClick={() => { void save(() => onDelete(project.id)); }}><Icon name="trash" size={15} /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>}
        <form className="project-form" onSubmit={async (event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          if (await save(() => onCreate(draft))) {
            setDraft("");
            if (mode === "create") { dialog.current?.close(); return; }
          }
          requestAnimationFrame(() => { if (dialog.current?.open) newName.current?.focus(); });
        }}>
          <label className="project-name-field">{t.newProject}
            <input ref={newName} className="form-control" value={draft} maxLength={80} onChange={(event) => setDraft(event.target.value)} />
          </label>
          <button className="btn btn-primary" type="submit" disabled={!draft.trim()}>{t.createProject}</button>
        </form>
      </fieldset>
      {error && <p className="notice is-error" role="status">{error}</p>}
    </dialog>
  );
}
