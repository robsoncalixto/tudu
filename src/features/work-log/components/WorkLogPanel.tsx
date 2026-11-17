"use client";

import type { Settings } from "@/features/settings/schema";
import { errorMessage } from "@/i18n";
import { useLocale } from "@/i18n/use-locale";
import { GROUPINGS, type Grouping } from "../schema";
import { groupLabel } from "../format";
import { useWorkLog } from "../use-work-log";

export function WorkLogPanel({ settings }: { settings: Settings }) {
  const { t } = useLocale(settings.locale);
  const log = useWorkLog(t);
  const unavailable = log.loading || log.loadError || !log.completed.length;
  return (
    <main className="page-content work-log-page">
      <header className="page-header">
        <a className="brand-name" href="/">TUDU</a>
        <a className="btn btn-secondary" href="/">{t.backToTasks}</a>
      </header>
      <h1>{t.workLog}</h1>
      <p className="hint">{t.workLogHint}</p>
      <div className="card work-log-controls">
        <label>{t.workLogDay}
          <input type="date" required value={log.day} onChange={(event) => log.setDay(event.target.value)} />
        </label>
        <label>{t.groupBy}
          <select aria-label={t.groupBy} value={log.grouping} onChange={(event) => log.setGrouping(event.target.value as Grouping)}>
            {GROUPINGS.map((grouping) => <option key={grouping} value={grouping}>{t.workLogGroupings[grouping]}</option>)}
          </select>
        </label>
        <button className="chip" type="button" disabled={log.loading} onClick={() => { void log.reload(); }}>{t.refreshWorkLog}</button>
      </div>
      <p className="hint work-log-zone">{log.timeZone && t.workLogTimeZone(log.timeZone)}</p>
      <div className="work-log-actions">
        <button type="button" className="btn btn-secondary" disabled={unavailable || log.copying} onClick={() => { void log.copy("text"); }}>{t.copyText}</button>
        <button type="button" className="btn btn-secondary" disabled={unavailable || log.copying} onClick={() => { void log.copy("markdown"); }}>{t.copyMarkdown}</button>
        <button type="button" className="btn btn-primary" disabled={unavailable || !log.aiEnabled || log.busy}
          aria-describedby={!log.aiEnabled ? "work-log-ai-hint" : undefined} onClick={() => { void log.summarize(); }}>
          {log.busy ? t.creating : t.summarizeWorkLog}
        </button>
      </div>
      {!log.aiEnabled && <p className="hint" id="work-log-ai-hint">{t.aiOff}</p>}
      <p className={`notice${log.error || log.loadError ? " is-error" : " is-ok"}`} role="status">
        {log.error ? errorMessage(t, log.error) : log.loadError ? t.workLogLoadFailed
          : log.notice === "copied" ? t.workLogCopied : log.notice === "generated" ? t.workLogGenerated : ""}
      </p>
      {log.manualCopy !== null && <label className="work-log-manual">{t.manualCopy}
        <textarea readOnly value={log.manualCopy} onFocus={(event) => event.currentTarget.select()} rows={8} />
      </label>}
      {log.loading ? <p>{t.loading}</p> : !log.loadError && <>
        <h2 className="section-title">{t.countCompleted(log.completed.length)}</h2>
        {log.grouping === "tag" && log.completed.some((task) => task.tags.length > 1) && <p className="hint">{t.workLogTagsHint}</p>}
        {log.summary && <section className="card work-log-summary" aria-labelledby="work-log-summary-heading">
          <h2 className="section-title" id="work-log-summary-heading">{t.aiWorkLogSummary}</h2>
          <p>{log.summary}</p><p className="hint">{t.workLogAiHint}</p>
        </section>}
        {!log.completed.length ? <div className="card empty"><p>{t.emptyWorkLog}</p></div>
          : log.groups.map((group) => <section className="card work-log-group" key={group.key}>
            {groupLabel(group, t) && <h3>{groupLabel(group, t)}</h3>}
            <ul>{group.tasks.map((task) => <li key={task.id}>{task.title}</li>)}</ul>
          </section>)}
      </>}
    </main>
  );
}
