"use client";

import { useCallback, useMemo, useState } from "react";
import { errorMessage } from "@/i18n";
import { useLocale } from "@/i18n/use-locale";
import { longDate } from "@/lib/dates";
import { errorCode } from "@/lib/http";
import { useToday } from "@/lib/use-today";
import { buildTaskView } from "../selectors";
import { useTasks } from "../use-tasks";
import { Composer, type ComposerMode } from "./Composer";
import { Sidebar } from "./Sidebar";
import { TaskList } from "./TaskList";

type Notice = { kind: "ok" | "error"; text: string } | null;

export function Board() {
  const { locale, setLocale, t } = useLocale();
  const today = useToday();
  const [notice, setNotice] = useState<Notice>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());

  const fail = useCallback((code: string) => setNotice({ kind: "error", text: errorMessage(t, code) }), [t]);
  const { tasks, aiEnabled, add, capture, patch, remove } = useTasks(fail);
  const view = useMemo(() => buildTaskView(tasks ?? [], tagFilter), [tasks, tagFilter]);

  async function submit(mode: ComposerMode, text: string): Promise<boolean> {
    if (!today) return false;
    setNotice(null);
    try {
      const created =
        mode === "ai" ? await capture(text, today) : await add(text.replace(/\s+/g, " ").slice(0, 300));
      setFresh(new Set(created.map((task) => task.id)));
      setTagFilter(null);
      if (mode === "ai") setNotice({ kind: "ok", text: t.added(created.length) });
      return true;
    } catch (error) {
      fail(errorCode(error));
      return false;
    }
  }

  const date = today ? longDate(today, locale) : null;
  const list = { today: today ?? "", locale, t, onPatch: patch, onDelete: remove, onTag: setTagFilter };

  return (
    <div className="shell">
      <Sidebar
        t={t}
        locale={locale}
        onLocale={setLocale}
        openCount={view.openCount}
        tagCounts={view.tagCounts}
        tagFilter={tagFilter}
        onTag={setTagFilter}
      />

      <main className="panel">
        <div className="content">
          <header className="day">
            <p className="eyebrow">{date ? date.weekday : " "}</p>
            <h1>{date ? date.rest : " "}</h1>
            <div className="tally">
              {tasks ? (
                <>
                  <span className="chip">{t.countOpen(view.openCount)}</span>
                  <span className="chip chip-success">{t.countDone(tasks.length - view.openCount)}</span>
                </>
              ) : (
                <span className="chip">{t.loading}</span>
              )}
            </div>
          </header>

          <Composer t={t} aiEnabled={aiEnabled} onSubmit={submit} />

          <p className={`notice${notice ? ` is-${notice.kind}` : ""}`} role="status">
            {notice?.text}
          </p>

          {tasks && (
            <>
              <section aria-labelledby="open-heading">
                <h2 id="open-heading" className="section-title">
                  {tagFilter ? `#${tagFilter}` : t.open} <span>{view.open.length}</span>
                </h2>
                {view.open.length === 0 ? (
                  <div className="card empty">
                    <p className="empty-title">{tagFilter ? t.emptyFiltered : t.emptyTitle}</p>
                    {!tagFilter && <p>{t.emptyBody}</p>}
                  </div>
                ) : (
                  <TaskList tasks={view.open} header fresh={fresh} {...list} />
                )}
              </section>

              {view.done.length > 0 && (
                <details className="done">
                  <summary className="section-title">
                    {t.done} <span>{view.done.length}</span>
                  </summary>
                  <TaskList tasks={view.done} {...list} />
                </details>
              )}
            </>
          )}

          <footer className="colophon">{t.tagline}</footer>
        </div>
      </main>
    </div>
  );
}
