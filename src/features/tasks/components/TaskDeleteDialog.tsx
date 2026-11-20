"use client";

import { useEffect, useId, useRef } from "react";
import { Icon } from "@/lib/Icon";
import type { Dictionary } from "@/i18n";
import type { Task } from "../schema";

interface Props {
  dialog: Pick<Task, "id" | "title"> | null;
  deleting: boolean;
  deleteFailed: boolean;
  t: Dictionary;
  onClose: () => void;
  onClosed: () => void;
  onDelete: () => Promise<void>;
}

export function TaskDeleteDialog({ dialog, deleting, deleteFailed, t, onClose, onClosed, onDelete }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const description = useId();
  useEffect(() => {
    const node = ref.current;
    node?.addEventListener("close", onClosed);
    return () => node?.removeEventListener("close", onClosed);
  }, [onClosed]);
  useEffect(() => {
    if (dialog && !ref.current?.open) ref.current?.showModal();
    else if (!dialog && ref.current?.open) ref.current.close();
  }, [dialog]);
  return (
    <dialog ref={ref} className="task-delete-dialog card" aria-labelledby={heading} aria-describedby={description} aria-busy={deleting}
      onCancel={(event) => { event.preventDefault(); if (!deleting) onClose(); }}>
      <h2 id={heading}>{t.confirmDelete}</h2>
      <p id={description}>{dialog && t.confirmDeleteTask(dialog.title)}</p>
      {dialog && <>
        <p>{t.deleteWarning}</p>
        {deleteFailed && <p className="task-delete-error" role="alert">{t.errors.generic}</p>}
        <div className="task-delete-actions">
          <button type="button" className="btn btn-secondary" autoFocus disabled={deleting} onClick={onClose}>{t.cancel}</button>
          <button type="button" className="btn task-delete-danger" disabled={deleting} onClick={() => { void onDelete(); }}>
            <Icon name="trash" size={17} />{deleting ? t.deletingTask : t.delete}
          </button>
        </div>
      </>}
    </dialog>
  );
}
