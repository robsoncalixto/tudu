"use client";

import { useState } from "react";
import type { Dictionary, Locale } from "@/i18n";
import { weekdayName } from "@/lib/dates";
import type { RepeatRule } from "@/features/recurrence/schema";
import type { Task, TaskPatch } from "../schema";

interface Props {
  task: Task;
  today: string;
  locale: Locale;
  t: Dictionary;
  onChange: (patch: TaskPatch) => Promise<boolean>;
}

export function TaskRepeat({ task, today, locale, t, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [frequency, setFrequency] = useState<RepeatRule["frequency"] | "never">("never");
  const [due, setDue] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [day, setDay] = useState(1);
  const [busy, setBusy] = useState(false);
  const repeat = task.repeat ?? null;
  const description = !repeat ? t.repeatFrequencies.never
    : repeat.frequency === "weekly" ? `${t.repeatFrequencies.weekly}: ${repeat.days.map((day) => weekdayName(day, locale)).join(", ")}`
    : repeat.frequency === "monthly" ? t.repeatMonthlyDay(repeat.day) : t.repeatFrequencies[repeat.frequency];

  function reset() {
    const date = task.due ?? today;
    setFrequency(repeat?.frequency ?? "never");
    setDue(date);
    setDays(repeat?.frequency === "weekly" ? repeat.days : [new Date(`${date}T12:00:00Z`).getUTCDay()]);
    setDay(repeat?.frequency === "monthly" ? repeat.day : Number(date.slice(-2)) || 1);
  }

  async function save(rule: RepeatRule | null) {
    setBusy(true);
    try {
      if (await onChange(rule ? { repeat: rule, due } : { repeat: null })) setOpen(false);
    } finally { setBusy(false); }
  }

  return (
    <details className="repeat-editor" open={open}>
      <summary onClick={(event) => {
        event.preventDefault();
        if (!open) reset();
        setOpen(!open);
      }}>{t.repeat}: {description}</summary>
      <form onSubmit={(event) => {
        event.preventDefault();
        const rule: RepeatRule | null = frequency === "never" ? null : frequency === "weekly"
          ? { frequency, days } : frequency === "monthly" ? { frequency, day } : { frequency };
        void save(rule);
      }}>
        <fieldset disabled={busy}>
          <legend className="sr-only">{t.repeat}</legend>
          <label>{t.repeatFrequency}
            <select aria-label={t.repeatFrequency} value={frequency} onChange={(event) => setFrequency(event.target.value as typeof frequency)}>
              {Object.entries(t.repeatFrequencies).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {frequency !== "never" && <label>{t.repeatFrom}
            <input type="date" required value={due} onChange={(event) => setDue(event.target.value)} />
          </label>}
          {frequency === "weekly" && <fieldset className="repeat-weekdays">
            <legend>{t.repeatDays}</legend>
            {[1, 2, 3, 4, 5, 6, 0].map((weekday) => <label key={weekday}>
              <input type="checkbox" checked={days.includes(weekday)} onChange={(event) => {
                setDays(event.target.checked ? [...days, weekday] : days.filter((day) => day !== weekday));
              }} />{weekdayName(weekday, locale)}
            </label>)}
          </fieldset>}
          {frequency === "monthly" && <label>{t.repeatDayOfMonth}
            <input type="number" min={1} max={31} required value={day} onChange={(event) => setDay(Number(event.target.value))} />
          </label>}
          <p className="hint">{t.repeatHint}</p>
          <div className="repeat-actions">
            <button className="chip" type="submit" disabled={frequency === "weekly" && days.length === 0}>{t.saveRepeat}</button>
            {repeat && <button className="chip" type="button" onClick={() => { void save(null); }}>{t.removeRepeat}</button>}
            <button className="chip" type="button" onClick={() => setOpen(false)}>{t.cancel}</button>
          </div>
        </fieldset>
      </form>
    </details>
  );
}
