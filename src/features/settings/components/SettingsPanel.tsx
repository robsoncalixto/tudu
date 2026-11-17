"use client";

import { errorMessage } from "@/i18n";
import { useLocale } from "@/i18n/use-locale";
import { PRIORITIES } from "@/features/tasks/schema";
import type { Settings } from "../schema";
import { useSettings } from "../use-settings";

export function SettingsPanel({ initial, aiEnabled }: { initial: Settings; aiEnabled: boolean }) {
  const { saved, draft, change, save, busy, dirty, error, savedNotice } = useSettings(initial);
  const { t } = useLocale(saved.locale);
  return (
    <main className="settings-page">
      <header className="settings-header">
        <a className="brand-name" href="/">TUDU</a>
        <a className="btn btn-secondary" href="/">{t.backToTasks}</a>
      </header>
      <h1>{t.settings}</h1>
      <form className="card" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <fieldset disabled={busy} className="settings-fields">
          <legend className="sr-only">{t.preferences}</legend>
          <label>{t.language}
            <select value={draft.locale} onChange={(event) => change({ locale: event.target.value as Settings["locale"] })}>
              <option value="en">{t.english}</option>
              <option value="pt-BR">{t.portuguese}</option>
            </select>
          </label>
          <label>{t.defaultPriority}
            <select value={draft.defaultPriority} onChange={(event) => change({ defaultPriority: event.target.value as Settings["defaultPriority"] })}>
              {PRIORITIES.map((priority) => <option key={priority} value={priority}>{t[priority]}</option>)}
            </select>
          </label>
          <label>{t.startView}
            <select value={draft.startView} onChange={(event) => change({ startView: event.target.value as Settings["startView"] })}>
              <option value="all">{t.allTasks}</option>
              <option value="today">{t.today}</option>
            </select>
          </label>
          <label>{t.dateFormat}
            <select value={draft.dateFormat} onChange={(event) => change({ dateFormat: event.target.value as Settings["dateFormat"] })}>
              <option value="locale">{t.localeDateFormat}</option>
              <option value="iso">{t.isoDateFormat}</option>
            </select>
          </label>
          <button className="btn btn-primary" type="submit" disabled={!dirty}>{busy ? t.savingSettings : t.saveSettings}</button>
        </fieldset>
      </form>
      <p className={`notice${error ? " is-error" : savedNotice ? " is-ok" : ""}`} role="status">
        {error ? errorMessage(t, error) : savedNotice ? t.settingsSaved : ""}
      </p>
      <section className="card settings-ai" aria-labelledby="ai-settings-heading">
        <h2 className="section-title" id="ai-settings-heading">{t.aiSettings}</h2>
        <p>{aiEnabled ? t.aiConfigured : t.aiOff}</p>
      </section>
    </main>
  );
}
