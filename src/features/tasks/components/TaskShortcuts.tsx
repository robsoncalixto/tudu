"use client";

import { useEffect, useId, useRef } from "react";
import type { Dictionary } from "@/i18n";
import type { ShortcutDialog } from "../shortcut-schema";

interface Props {
  dialog: ShortcutDialog | null;
  deleting: boolean;
  deleteFailed: boolean;
  t: Dictionary;
  onClose: () => void;
  onClosed: () => void;
  onDelete: () => Promise<void>;
}

export function TaskShortcuts({ dialog, deleting, deleteFailed, t, onClose, onClosed, onDelete }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const description = useId();
  useEffect(() => {
    const node = ref.current;
    node?.addEventListener("close", onClosed);
    return () => node?.removeEventListener("close", onClosed);
  }, [onClosed]);
  useEffect(() => {
    if (dialog && !ref.current?.open) {
      ref.current?.showModal();
      if (dialog.kind === "help") {
        ref.current?.querySelector<HTMLHeadingElement>("h2")?.focus();
        if (ref.current) ref.current.scrollTop = 0;
      }
    }
    else if (!dialog && ref.current?.open) ref.current.close();
  }, [dialog]);
  const confirming = dialog?.kind === "delete";
  return (
    <dialog ref={ref} className="task-shortcuts card" aria-labelledby={heading} aria-describedby={description} aria-busy={deleting}
      onCancel={(event) => { event.preventDefault(); if (!deleting) onClose(); }}>
      <h2 id={heading} tabIndex={confirming ? undefined : -1}>{confirming ? t.confirmDelete : t.keyboardShortcuts}</h2>
      <p id={description}>{confirming ? t.confirmDeleteTask(dialog.title) : t.shortcutsHint}</p>
      {confirming ? <>
        <p>{t.deleteWarning}</p>
        {deleteFailed && <p className="shortcut-error" role="alert">{t.errors.generic}</p>}
        <div className="shortcut-actions">
          <button type="button" className="btn btn-secondary" autoFocus disabled={deleting} onClick={onClose}>{t.cancel}</button>
          <button type="button" className="btn btn-primary" disabled={deleting} onClick={() => { void onDelete(); }}>{deleting ? t.deletingTask : t.delete}</button>
        </div>
      </> : <>
        <dl>{t.shortcutHelp.map(({ keys, description }) => <div key={keys}>
          <dt><kbd>{keys}</kbd></dt><dd>{description}</dd>
        </div>)}</dl>
        <button type="button" className="btn btn-secondary" onClick={onClose}>{t.closeShortcuts}</button>
      </>}
    </dialog>
  );
}
