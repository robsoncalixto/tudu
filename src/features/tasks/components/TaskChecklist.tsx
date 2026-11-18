"use client";

import { useId, useRef, useState, type RefObject } from "react";
import { Icon } from "@/lib/Icon";
import type { Dictionary } from "@/i18n";
import { createStep, stepProgress, type SubtaskVisibility } from "../checklist";
import type { Step } from "../schema";
import { useTaskDraft } from "../use-task-draft";

interface Props {
  id: string;
  taskId?: string;
  steps: Step[];
  visibility: SubtaskVisibility;
  adding: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  addButton: RefObject<HTMLButtonElement | null>;
  t: Dictionary;
  onCloseAdd: () => void;
  onChange: (steps: Step[]) => Promise<boolean>;
}

export function TaskPanelSubtasks({ taskId, steps, t, onChange }: Pick<Props, "steps" | "t" | "onChange"> & { taskId: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const add = useRef<HTMLButtonElement>(null);
  const { draft: open = false, onDraftChange: setOpen } = useTaskDraft<boolean>(taskId);
  const { draft: adding = false, onDraftChange: setAdding } = useTaskDraft<boolean>(taskId);
  const progress = stepProgress(steps);
  return <section className="inspector-subtasks">
    <div className="inspector-disclosure-line">
      <button className="inspector-disclosure" type="button" id={`${id}-toggle`} aria-label={t.checklist}
        aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <Icon name="list-checks" size={18} /><span>{t.checklist}</span>
        {progress.total > 0 && <span className="inspector-count">{t.stepCount(progress.done, progress.total)}</span>}
        <Icon name={open ? "chevron-down" : "chevron-right"} size={14} />
      </button>
      <button type="button" ref={add} className="inspector-icon" aria-label={t.addStep} title={t.addStep}
        disabled={steps.length >= 100} onClick={() => {
          setOpen(true); setAdding(true); requestAnimationFrame(() => input.current?.focus());
        }}><Icon name="plus" size={17} /></button>
    </div>
    {open && !steps.length && !adding && <p className="inspector-empty">{t.noSubtasks}</p>}
    <TaskChecklist id={id} taskId={taskId} t={t} steps={steps} onChange={onChange} adding={adding} inputRef={input} addButton={add}
      visibility={open ? "all" : "collapsed"} onCloseAdd={() => {
        setAdding(false); (add.current?.disabled ? document.getElementById(`${id}-toggle`) : add.current)?.focus();
      }} />
  </section>;
}

export function TaskChecklist({ id, taskId = id, steps, visibility, adding, inputRef, addButton, t, onCloseAdd, onChange }: Props) {
  const { draft = "", onDraftChange: setDraft } = useTaskDraft<string>(taskId);
  const { draft: editing, onDraftChange: setEditing } = useTaskDraft<{ id: string; title: string }>(taskId);
  const [busy, setBusy] = useState(false);
  const renameInput = useRef<HTMLInputElement>(null);
  const visible = visibility === "open" ? steps.filter((step) => !step.done) : steps;

  async function save(next: Step[]) {
    setBusy(true);
    try { return await onChange(next); }
    finally { setBusy(false); }
  }

  // Saving temporarily disables the fieldset. Restore the control once it is enabled again.
  function restoreFocus(target: () => HTMLElement | null, form?: HTMLFormElement) {
    requestAnimationFrame(() => {
      if (document.activeElement === document.body || form?.contains(document.activeElement)) {
        (target() ?? addButton.current)?.focus();
      }
    });
  }

  function finishRename(stepId: string) {
    setEditing(undefined);
    restoreFocus(() => document.getElementById(`${id}-title-${stepId}`));
  }

  function cancelAdd() {
    setDraft(undefined);
    onCloseAdd();
  }

  return (
    <fieldset className="subtasks" id={id} data-subtasks disabled={busy}
      hidden={visibility === "collapsed" || (!visible.length && !adding)}>
      <legend className="sr-only">{t.checklist}</legend>
      {visible.length > 0 && <ul className="subtask-list" aria-label={t.checklist}>
        {visible.map((step, index) => (
          <li key={step.id} className="subtask-row">
            {editing?.id === step.id ? (
              <form className="subtask-form" onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const title = editing.title.trim();
                if (title && await save(steps.map((item) => item.id === step.id ? { ...item, title } : item))) {
                  finishRename(step.id);
                } else restoreFocus(() => form.querySelector("input"), form);
              }}>
                <input className="form-control" ref={renameInput} value={editing.title} maxLength={300} aria-label={t.stepTitle}
                  onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && !event.nativeEvent.isComposing) {
                      event.preventDefault(); event.stopPropagation(); finishRename(step.id);
                    }
                  }} />
                <button type="submit" className="chip" disabled={!editing.title.trim()}>{t.saveStep}</button>
                <button type="button" className="chip" onClick={() => finishRename(step.id)}>{t.cancel}</button>
              </form>
            ) : (
              <>
                <input type="checkbox" className="subtask-check" id={`${id}-check-${step.id}`} aria-label={step.title}
                  checked={step.done} onChange={async () => {
                    await save(steps.map((item) => item.id === step.id ? { ...item, done: !item.done } : item));
                    restoreFocus(() => document.getElementById(`${id}-check-${step.id}`)
                      ?? document.getElementById(`${id}-toggle`));
                  }} />
                <button type="button" className="subtask-title" id={`${id}-title-${step.id}`}
                  aria-label={t.renameStep(step.title)} title={t.renameStep(step.title)}
                  onClick={() => {
                    setEditing({ id: step.id, title: step.title });
                    requestAnimationFrame(() => renameInput.current?.focus());
                  }}>{step.title}</button>
                <button type="button" className="subtask-delete" aria-label={t.deleteStep(step.title)} title={t.deleteStep(step.title)}
                  onClick={async () => {
                    const removed = await save(steps.filter((item) => item.id !== step.id));
                    const next = removed ? visible[index + 1] ?? visible[index - 1] : step;
                    restoreFocus(() => next ? document.getElementById(`${id}-title-${next.id}`) : null);
                  }}><Icon name="trash" size={15} /></button>
              </>
            )}
          </li>
        ))}
      </ul>}
      {adding && <form className="subtask-form subtask-entry" onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (draft.trim() && steps.length < 100 && await save([...steps, createStep(draft)])) setDraft(undefined);
        restoreFocus(() => inputRef.current?.disabled ? form.querySelector<HTMLButtonElement>("button[type=button]") : inputRef.current, form);
      }}>
        <input className="form-control" ref={inputRef} value={draft} maxLength={300}
          aria-label={t.newStep} placeholder={t.newStep} disabled={steps.length >= 100}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !event.nativeEvent.isComposing) {
              event.preventDefault(); event.stopPropagation(); cancelAdd();
            }
          }} />
        <button type="submit" className="chip" disabled={!draft.trim() || steps.length >= 100}>{t.add}</button>
        <button type="button" className="chip" onClick={cancelAdd}>{t.cancel}</button>
      </form>}
      {steps.length >= 100 && <p className="hint">{t.stepLimit}</p>}
    </fieldset>
  );
}
