"use client";

import { useRef, useState } from "react";
import type { Dictionary, Locale } from "@/i18n";
import { Icon } from "@/lib/Icon";
import { repeatDescription } from "../recurrence";
import { weekdayName } from "@/lib/dates";
import type { RepeatRule } from "@/features/recurrence/schema";
import type { Task, TaskPatch } from "../schema";
import { useTaskDraft } from "../use-task-draft";

interface RepeatDraft {
  frequency: RepeatRule["frequency"] | "never";
  due: string;
  days: number[];
  day: string;
}

interface Props {
  task: Task;
  today: string;
  locale: Locale;
  t: Dictionary;
  onChange: (patch: TaskPatch) => Promise<boolean>;
}

export function TaskRepeat({ task, today, locale, t, onChange }: Props) {
  const { draft, onDraftChange: setDraft } = useTaskDraft<RepeatDraft>(task.id);
  const summary = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const repeat = task.repeat ?? null;

  function open() {
    const date = task.due ?? today;
    setDraft({
      frequency: repeat?.frequency ?? "never",
      due: date,
      days: repeat?.frequency === "weekly" ? repeat.days : [new Date(`${date}T12:00:00Z`).getUTCDay()],
      day: String(repeat?.frequency === "monthly" ? repeat.day : Number(date.slice(-2)) || 1),
    });
  }

  function close() {
    setDraft(undefined);
    if (document.activeElement === document.body || summary.current?.parentElement?.contains(document.activeElement)) {
      summary.current?.focus();
    }
  }

  async function save(rule: RepeatRule | null) {
    if (!draft) return;
    setBusy(true);
    try {
      if (await onChange(rule ? { repeat: rule, due: draft.due } : { repeat: null })) close();
    } finally { setBusy(false); }
  }

  return (
    <details className="repeat-editor" open={Boolean(draft)}>
      <summary ref={summary} onClick={(event) => {
        event.preventDefault();
        if (draft) close(); else open();
      }}><Icon name="repeat" size={16} />{t.repeat}: {repeatDescription(repeat, locale, t)}<Icon name="chevron-down" size={13} /></summary>
      {draft && <form onKeyDown={(event) => {
        if (event.key !== "Escape" || event.nativeEvent.isComposing) return;
        if (CSS.supports("selector(select:open)") && event.target instanceof Element && event.target.closest("select:open")) return;
        event.preventDefault(); event.stopPropagation(); close();
      }} onSubmit={(event) => {
        event.preventDefault();
        const { frequency, days, day } = draft;
        const rule: RepeatRule | null = frequency === "never" ? null : frequency === "weekly"
          ? { frequency, days } : frequency === "monthly" ? { frequency, day: Number(day) } : { frequency };
        void save(rule);
      }}>
        <fieldset disabled={busy}>
          <legend className="sr-only">{t.repeat}</legend>
          <label>{t.repeatFrequency}
            <select className="select-control" aria-label={t.repeatFrequency} value={draft.frequency} onChange={(event) => setDraft({ ...draft, frequency: event.target.value as RepeatDraft["frequency"] })}>
              {Object.entries(t.repeatFrequencies).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {draft.frequency !== "never" && <label>{t.repeatFrom}
            <input className="form-control" type="date" required value={draft.due} onChange={(event) => setDraft({ ...draft, due: event.target.value })} />
          </label>}
          {draft.frequency === "weekly" && <fieldset className="repeat-weekdays">
            <legend>{t.repeatDays}</legend>
            {[1, 2, 3, 4, 5, 6, 0].map((weekday) => <label key={weekday}>
              <input type="checkbox" checked={draft.days.includes(weekday)} onChange={(event) => {
                setDraft({ ...draft, days: event.target.checked ? [...draft.days, weekday] : draft.days.filter((day) => day !== weekday) });
              }} />{weekdayName(weekday, locale)}
            </label>)}
          </fieldset>}
          {draft.frequency === "monthly" && <label>{t.repeatDayOfMonth}
            <input className="form-control" type="number" min={1} max={31} required value={draft.day} onChange={(event) => setDraft({ ...draft, day: event.target.value })} />
          </label>}
          <p className="hint">{t.repeatHint}</p>
          <div className="repeat-actions">
            <button className="chip" type="submit" disabled={draft.frequency === "weekly" && draft.days.length === 0}>{t.saveRepeat}</button>
            {repeat && <button className="chip" type="button" onClick={() => { void save(null); }}>{t.removeRepeat}</button>}
            <button className="chip" type="button" onClick={close}>{t.cancel}</button>
          </div>
        </fieldset>
      </form>}
    </details>
  );
}
