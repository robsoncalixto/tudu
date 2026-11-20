"use client";

import { errorMessage } from "@/i18n";
import { useLocale } from "@/i18n/use-locale";
import { PRIORITIES } from "@/features/tasks/schema";
import { THEMES, type Settings } from "../schema";
import { useSettings } from "../use-settings";
import { AI_PROVIDERS, type AiPublicConfiguration } from "@/features/ai/schema";
import { Icon } from "@/lib/Icon";
import { weekdayName } from "@/lib/dates";

const themeIcons = { system: "monitor", light: "sun", dark: "moon" } as const;

interface Props {
  initial: Settings;
  ai: AiPublicConfiguration;
  returnTo?: string;
}

export function SettingsPanel({ initial, ai, returnTo = "/" }: Props) {
  const { saved, draft, change, save, busy, dirty, error, savedNotice } = useSettings(initial);
  const { t } = useLocale(saved.locale);
  return (
    <main className="page-content settings-page">
      <header className="page-header settings-navigation">
        <a className="back-link" href={returnTo}><Icon name="arrow-left" />
          {returnTo === "/agent" ? t.backToAssistant : t.backToTasks}
        </a>
        <span className="brand-name">TUDU</span>
      </header>
      <h1>{t.settings}</h1>
      <form className="card" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <fieldset disabled={busy} className="settings-fields">
          <legend className="sr-only">{t.preferences}</legend>
          <fieldset className="theme-field">
            <legend>{t.colorTheme}</legend>
            <div className="theme-options">
              {THEMES.map((theme) => (
                <label key={theme}>
                  <input type="radio" name="theme" value={theme} checked={draft.theme === theme}
                    onChange={() => change({ theme })} />
                  <Icon name={draft.theme === theme ? "check" : themeIcons[theme]} size={16} />
                  <span>{t.themes[theme]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label>{t.language}
            <select className="select-control" value={draft.locale} onChange={(event) => change({ locale: event.target.value as Settings["locale"] })}>
              <option value="en">{t.english}</option>
              <option value="pt-BR">{t.portuguese}</option>
            </select>
          </label>
          <label>{t.defaultPriority}
            <select className="select-control" value={draft.defaultPriority} onChange={(event) => change({ defaultPriority: event.target.value as Settings["defaultPriority"] })}>
              {PRIORITIES.map((priority) => <option key={priority} value={priority}>{t[priority]}</option>)}
            </select>
          </label>
          <label>{t.startView}
            <select className="select-control" value={draft.startView} onChange={(event) => change({ startView: event.target.value as Settings["startView"] })}>
              <option value="all">{t.allTasks}</option>
              <option value="today">{t.today}</option>
            </select>
          </label>
          <label>{t.dateFormat}
            <select className="select-control" value={draft.dateFormat} onChange={(event) => change({ dateFormat: event.target.value as Settings["dateFormat"] })}>
              <option value="locale">{t.localeDateFormat}</option>
              <option value="iso">{t.isoDateFormat}</option>
            </select>
          </label>
          <fieldset className="work-capacity">
            <legend className="section-title">{t.workCapacity}</legend>
            <div className="work-days">{[1, 2, 3, 4, 5, 6, 0].map((day) => <label key={day}>
              <input type="checkbox" checked={draft.workingDays.includes(day)}
                disabled={draft.workingDays.length === 1 && draft.workingDays.includes(day)}
                onChange={(event) => change({ workingDays: event.target.checked
                  ? [...draft.workingDays, day].sort() : draft.workingDays.filter((workingDay) => workingDay !== day) })} />
              {weekdayName(day, saved.locale)}
            </label>)}</div>
            <label>{t.workHoursPerDay}<input type="number" min={0.25} max={24} step="any" className="form-control"
              value={draft.workHoursPerDay || ""} onChange={(event) => change({ workHoursPerDay: Number(event.target.value) })} /></label>
          </fieldset>
          <section className="settings-ai" aria-labelledby="ai-settings-heading">
            <h2 className="section-title" id="ai-settings-heading">{t.aiSettings}</h2>
            <p className="hint">{ai.available[draft.aiProvider] ? t.aiConfigured : t.aiOff}</p>
            <label>{t.aiProvider}
              <select className="select-control" value={draft.aiProvider} onChange={(event) => change({ aiProvider: event.target.value as Settings["aiProvider"], aiModel: "" })}>
                {AI_PROVIDERS.map((provider) => <option key={provider} value={provider}>{t.aiProviders[provider]}</option>)}
              </select>
            </label>
            <label>{t.aiModel}
              <input className="form-control" value={draft.aiModel} maxLength={160} placeholder={ai.models[draft.aiProvider]} aria-describedby="ai-model-hint"
                onChange={(event) => change({ aiModel: event.target.value })} />
            </label>
            <p className="hint" id="ai-model-hint">{t.aiModelHint}</p>
          </section>
        </fieldset>
        <div className="settings-savebar">
          <button className="btn btn-primary" type="submit" disabled={busy || !dirty}>{busy ? t.savingSettings : t.saveSettings}</button>
          <p className={`notice${error ? " is-error" : savedNotice ? " is-ok" : ""}`} role="status">
            {error ? errorMessage(t, error) : savedNotice ? t.settingsSaved : ""}
          </p>
        </div>
      </form>
    </main>
  );
}
