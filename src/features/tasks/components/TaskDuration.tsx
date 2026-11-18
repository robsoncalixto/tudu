"use client";

import { useId, useRef, useState } from "react";
import { Icon } from "@/lib/Icon";
import { changeDurationUnit, durationToHours, formatDuration } from "../duration";
import { DURATION_UNITS, durationUnitSchema, type DurationDraft, type DurationUnit } from "../schema";
import { useResourceForm, type ResourceProps } from "../use-resource-form";
import { ResourceFeedback } from "./TaskResources";

interface Props extends ResourceProps<DurationDraft> {
  field: "estimateHours" | "realTimeHours";
}

export function TaskDuration(props: Props) {
  const { task, t, field } = props;
  const form = useResourceForm(props);
  const [selectedUnit, setSelectedUnit] = useState<DurationUnit>("hours");
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const unit = form.draft?.unit ?? selectedUnit;
  const value = form.draft?.value ?? formatDuration(task[field], unit);
  const label = field === "estimateHours" ? t.taskResources.estimate : t.taskResources.realTime;
  const saveLabel = field === "estimateHours" ? t.taskResources.saveEstimate : t.taskResources.saveRealTime;
  return <form className="task-duration" aria-label={label} noValidate onSubmit={async (event) => {
    event.preventDefault();
    if (form.saving) return;
    const parsed = durationToHours(value, unit);
    if (input.current?.validity.badInput || !parsed.success) {
      form.setMessage("invalidDuration");
      return;
    }
    const hours = form.draft?.hours === undefined ? parsed.data : form.draft.hours;
    if (await form.save({ [field]: hours })) {
      setSelectedUnit(unit);
      form.edit(undefined);
    }
    if (document.activeElement === document.body) input.current?.focus();
  }}>
    <div className="inspector-property">
      <label htmlFor={id} className="inspector-label"><Icon name="clock" size={17} />{label}</label>
      <div className="resource-input-row">
        <select className="select-control duration-unit" aria-label={t.taskResources.durationUnit(label)}
          aria-describedby={`${id}-hint`} value={unit} disabled={form.saving} onChange={(event) => {
            form.edit(changeDurationUnit(form.draft ?? { value, unit, hours: task[field] }, durationUnitSchema.parse(event.target.value)));
            form.setMessage(null);
          }}>
          {DURATION_UNITS.map((option) => <option key={option} value={option}>{t.taskResources.units[option]}</option>)}
        </select>
        <input ref={input} id={id} className="form-control duration-input" type="number" inputMode="decimal"
          min="0" step="any" value={value} readOnly={form.saving}
          aria-describedby={`${id}-hint${form.message ? ` ${id}-feedback` : ""}`}
          aria-invalid={form.message === "invalidDuration" || undefined} onChange={(event) => {
            form.edit({ value: event.target.value, unit }); form.setMessage(null);
          }} />
        {(form.draft !== undefined || form.saving) && <button type="submit" className="icon-btn resource-confirm"
          disabled={form.saving} aria-label={saveLabel} title={saveLabel}><Icon name="check" size={17} /></button>}
      </div>
    </div>
    <p className="hint duration-hint" id={`${id}-hint`}>{t.taskResources.durationHint}</p>
    <ResourceFeedback id={`${id}-feedback`} message={form.message} t={t} />
  </form>;
}
