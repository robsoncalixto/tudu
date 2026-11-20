"use client";

import { useRef } from "react";
import type { Project } from "@/features/projects/schema";
import { REPEAT_FREQUENCIES, type RepeatFrequency } from "@/features/recurrence/schema";
import type { Dictionary, Locale } from "@/i18n";
import { dueLabel, type DateFormat } from "@/lib/dates";
import type { IconName } from "@/lib/Icon";
import type { ComposerValues } from "../composer-draft";
import { durationLabel } from "../duration";
import { postponementDate } from "../planning";
import type { Priority } from "../schema";
import { ChipMenu, type ChipOption } from "./ChipMenu";
import { TagPicker } from "./TagPicker";

const ESTIMATES = [0.25, 0.5, 1, 2, 4, 12];
const PRIORITY_KEYS: [Priority, string][] = [["high", "1"], ["medium", "2"], ["low", "3"]];

interface Props {
  t: Dictionary;
  locale: Locale;
  dateFormat: DateFormat;
  today: string;
  values: ComposerValues;
  projects: Project[];
  savedTags: string[];
  disabled: boolean;
  onPriority: (value: Priority | null) => void;
  onDue: (value: string | null) => void;
  onPlanned: (value: string | null) => void;
  onProject: (value: string | null) => void;
  onEstimate: (value: number | null) => void;
  onRepeat: (value: RepeatFrequency | null) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

interface DayProps {
  t: Dictionary;
  icon: IconName;
  label: string;
  inputLabel: string;
  emptyLabel: string;
  today: string;
  value: string | null;
  text: string | null;
  note?: string;
  disabled: boolean;
  onChange: (value: string | null) => void;
}

function DayChip({ t, icon, label, inputLabel, emptyLabel, today, value, text, note, disabled, onChange }: DayProps) {
  const input = useRef<HTMLInputElement>(null);
  const days: [string, string][] = today ? [[t.today, today], [t.tomorrow, postponementDate(today, "tomorrow")],
    [t.postponeNextWeek, postponementDate(today, "next-week")]] : [];
  const options: ChipOption[] = [
    ...days.map(([name, date]) => ({ key: date, label: name, checked: value === date, onSelect: () => onChange(date) })),
    { key: "none", label: emptyLabel, checked: value === null, onSelect: () => onChange(null) },
    // The calendar is the browser's own, anchored to the chip.
    { key: "pick", label: t.pickDate, onSelect: () => { try { input.current?.showPicker(); } catch { input.current?.focus(); } } },
  ];
  return <ChipMenu icon={icon} label={label} value={text} note={note} options={options} disabled={disabled}
    clearLabel={t.composerClear(label)} onClear={() => onChange(null)}>
    <input ref={input} type="date" className="chip-date" tabIndex={-1} aria-label={inputLabel} value={value ?? ""} disabled={disabled}
      onChange={(event) => onChange(event.target.value || null)} />
  </ChipMenu>;
}

/** The fields of the task being written. Each chip mirrors the typed token and can set the value itself. */
export function ComposerChips({ t, locale, dateFormat, today, values, projects, savedTags, disabled, ...on }: Props) {
  const day = (value: string | null) => value && today ? dueLabel(value, today, locale, t, dateFormat) : value;
  const project = projects.find((item) => item.id === values.projectId);
  const due = day(values.due);
  const projectOptions: ChipOption[] = [
    { key: "none", label: t.noProject, checked: values.projectId === null, onSelect: () => on.onProject(null) },
    ...[...projects].sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({ key: item.id, label: item.name, checked: item.id === values.projectId, onSelect: () => on.onProject(item.id) })),
  ];
  const estimateOptions: ChipOption[] = [
    ...ESTIMATES.map((hours) => ({ key: String(hours), label: durationLabel(hours, locale), checked: values.estimateHours === hours, onSelect: () => on.onEstimate(hours) })),
    { key: "none", label: t.noEstimate, checked: values.estimateHours === null, onSelect: () => on.onEstimate(null) },
  ];
  return <div className="composer-chips" role="group" aria-label={t.composerDetails}>
    {projects.length > 0 && <ChipMenu icon="folder" label={t.project} value={project?.name ?? null} options={projectOptions} disabled={disabled}
      clearLabel={t.composerClear(t.project)} onClear={() => on.onProject(null)} />}
    <DayChip t={t} icon="sun" label={t.agentPlannedFor} inputLabel={t.composerPlanned} emptyLabel={t.noPlannedDay} today={today}
      value={values.plannedFor} text={day(values.plannedFor)} disabled={disabled} onChange={on.onPlanned} />
    <DayChip t={t} icon="calendar" label={t.setDate} inputLabel={t.composerDue} emptyLabel={t.noDate} today={today} value={values.due}
      text={due && values.partOfDay ? `${due} · ${t.partsOfDay[values.partOfDay]}` : due}
      note={values.time && values.partOfDay ? t.composerTimeNote(values.time, t.partsOfDay[values.partOfDay]) : undefined}
      disabled={disabled} onChange={on.onDue} />
    <ChipMenu icon="flag" label={t.priority} value={values.priority ? t[values.priority] : null} disabled={disabled}
      options={PRIORITY_KEYS.map(([priority, hotkey]) => ({
        key: priority, label: t[priority], hotkey, checked: values.priority === priority, onSelect: () => on.onPriority(priority),
      }))} clearLabel={t.composerClear(t.priority)} onClear={() => on.onPriority(null)} />
    <ChipMenu icon="clock" label={t.taskResources.estimate} value={values.estimateHours === null ? null : durationLabel(values.estimateHours, locale)}
      options={estimateOptions} disabled={disabled} clearLabel={t.composerClear(t.taskResources.estimate)} onClear={() => on.onEstimate(null)} />
    <ChipMenu icon="repeat" label={t.repeat} value={values.repeat ? t.repeatFrequencies[values.repeat] : null} disabled={disabled}
      options={[
        { key: "never", label: t.repeatFrequencies.never, checked: values.repeat === null, onSelect: () => on.onRepeat(null) },
        ...REPEAT_FREQUENCIES.map((frequency) => ({
          key: frequency, label: t.repeatFrequencies[frequency], checked: values.repeat === frequency, onSelect: () => on.onRepeat(frequency),
        })),
      ]} clearLabel={t.composerClear(t.repeat)} onClear={() => on.onRepeat(null)} />
    <TagPicker t={t} tags={values.tags} saved={savedTags} disabled={disabled} onAdd={on.onAddTag} onRemove={on.onRemoveTag} />
  </div>;
}
