"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n";
import { createStep, stepProgress } from "../checklist";
import type { Step } from "../schema";

interface Props {
  steps: Step[];
  t: Dictionary;
  onChange: (steps: Step[]) => Promise<boolean>;
}

export function TaskChecklist({ steps, t, onChange }: Props) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const progress = stepProgress(steps);

  async function save(next: Step[]) {
    setBusy(true);
    try {
      return await onChange(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="checklist">
      <summary>{t.checklist} <span>{t.stepCount(progress.done, progress.total)}</span></summary>
      <fieldset disabled={busy}>
        <legend className="sr-only">{t.checklist}</legend>
        <ul className="checklist-steps">
          {steps.map((step) => (
            <li key={step.id}>
              {editing?.id === step.id ? (
                <form className="step-form" onSubmit={async (event) => {
                  event.preventDefault();
                  const title = editing.title.trim();
                  if (title && await save(steps.map((item) => item.id === step.id ? { ...item, title } : item))) {
                    setEditing(null);
                  }
                }}>
                  <input
                    value={editing.title} autoFocus maxLength={300} aria-label={t.stepTitle}
                    onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                    onKeyDown={(event) => { if (event.key === "Escape") setEditing(null); }}
                  />
                  <button type="submit" className="chip" disabled={!editing.title.trim()}>{t.saveStep}</button>
                  <button type="button" className="chip" onClick={() => setEditing(null)}>{t.cancelStep}</button>
                </form>
              ) : (
                <>
                  <label className={`step-label${step.done ? " is-done" : ""}`}>
                    <input type="checkbox" checked={step.done} onChange={() => {
                      void save(steps.map((item) => item.id === step.id ? { ...item, done: !item.done } : item));
                    }} />
                    <span>{step.title}</span>
                  </label>
                  <button
                    type="button" className="chip" aria-label={t.renameStep(step.title)}
                    onClick={() => setEditing({ id: step.id, title: step.title })}
                  >{t.editStep}</button>
                  <button
                    type="button" className="chip" aria-label={t.deleteStep(step.title)}
                    onClick={() => { void save(steps.filter((item) => item.id !== step.id)); }}
                  >×</button>
                </>
              )}
            </li>
          ))}
        </ul>
        <form className="step-form" onSubmit={async (event) => {
          event.preventDefault();
          if (draft.trim() && steps.length < 100 && await save([...steps, createStep(draft)])) setDraft("");
        }}>
          <input
            value={draft} maxLength={300} aria-label={t.newStep} placeholder={t.newStep}
            disabled={steps.length >= 100} onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className="chip" disabled={!draft.trim() || steps.length >= 100}>{t.addStep}</button>
        </form>
        {steps.length >= 100 && <p>{t.stepLimit}</p>}
      </fieldset>
    </details>
  );
}
