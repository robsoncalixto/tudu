"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/features/projects/schema";
import { quickAddApi } from "@/features/quick-add/api";
import type { QuickAddDefaults, QuickAddProblem, QuickTokenType } from "@/features/quick-add/schema";
import { shortcutsApi } from "@/features/shortcuts/api";
import type { Dictionary, Locale } from "@/i18n";
import type { DateFormat } from "@/lib/dates";
import { Icon } from "@/lib/Icon";
import { replaceFieldText } from "@/lib/text-field";
import { composerDefaults, composerValues, MAX_DRAFT_TAGS, NO_CHOICE, withoutTag, withTag, type ComposerChoice } from "../composer-draft";
import { CommandField } from "./CommandField";
import { ComposerBatch } from "./ComposerBatch";
import { ComposerChips } from "./ComposerChips";
import "./composer.css";

export type ComposerMode = "add" | "ai";

interface Props {
  t: Dictionary;
  today: string;
  locale: Locale;
  dateFormat: DateFormat;
  text: string;
  onTextChange: (value: string) => void;
  aiEnabled: boolean;
  /** What the current view adds to a new task. */
  context: QuickAddDefaults;
  projects: Project[];
  /** Saved tags. */
  suggestions: string[];
  onSubmit: (mode: ComposerMode, text: string, defaults: QuickAddDefaults) => Promise<boolean>;
  /** Escape on an empty field hands the keyboard back to the list. */
  onLeave: () => void;
}

export function Composer({ t, today, locale, dateFormat, aiEnabled, text, onTextChange, onSubmit, onLeave, context, projects, suggestions }: Props) {
  const [capturing, setCapturing] = useState(false);
  const [setup, setSetup] = useState(false);
  const [mod, setMod] = useState("Ctrl");
  const [choice, setChoice] = useState<ComposerChoice>(NO_CHOICE);
  const [problem, setProblem] = useState<QuickAddProblem | null>(null);
  const [tagLimit, setTagLimit] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const current = useRef(text);
  current.current = text;
  const defaults = composerDefaults(context, choice);
  const values = composerValues(text, today, defaults, projects);
  const drafts = quickAddApi.previewDrafts(text, today, defaults, projects);
  const lines = text.split(/\r?\n/u).filter((line) => line.trim()).length;
  const warnings = quickAddApi.warnings(text, today, projects);
  const disabled = !text.trim() || capturing;

  useEffect(() => { setMod(/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl"); }, []);
  useEffect(() => { setProblem(null); setTagLimit(false); }, [text, choice]);

  const refocus = () => requestAnimationFrame(() => field.current?.focus({ preventScroll: true }));
  /** Changes the text as typing would, so the browser can undo it. */
  function rewrite(next: string) {
    const input = field.current;
    if (!input || !replaceFieldText(input, 0, input.value.length, next)) onTextChange(next);
  }
  /** A chip takes over its field: the typed token goes and the chip keeps the value. */
  function choose(next: ComposerChoice, type?: QuickTokenType, value?: string) {
    setChoice(next);
    const stripped = type && !values.batch ? quickAddApi.stripTokens(text, today, projects, type, value) : text;
    if (stripped !== text) rewrite(stripped);
    refocus();
  }

  async function submit(mode: ComposerMode) {
    if (disabled) return;
    if (values.tags.length > MAX_DRAFT_TAGS) { setTagLimit(true); return; }
    const sent = { text, choice };
    if (mode === "ai") {
      setCapturing(true);
      try { if (await onSubmit("ai", text.trim(), defaults)) { onTextChange(""); setChoice(NO_CHOICE); } }
      finally { setCapturing(false); refocus(); }
      return;
    }
    if (!drafts) {
      setProblem(quickAddApi.problem(text, today, defaults, projects));
      void onSubmit("add", text.trim(), defaults);
      return;
    }
    // The field is free for the next task at once; a failed save brings this one back.
    onTextChange("");
    setChoice(NO_CHOICE);
    refocus();
    if (await onSubmit("add", sent.text.trim(), defaults)) return;
    onTextChange(current.current.trim() ? `${sent.text}\n${current.current}` : sent.text);
    setChoice(sent.choice);
  }

  const example = <>{t.composerPlaceholder} <span className="command-example">{t.composerExample.split(" ").map((word) =>
    <span key={word}><span className="command-token">{word}</span> </span>)}</span></>;

  return (
    <form className="composer quick-composer" aria-label={t.addTask} onSubmit={(event) => { event.preventDefault(); void submit("add"); }}>
      <div className="composer-entry">
        <div className="composer-field" onMouseDown={(event) => {
          if (event.target instanceof HTMLTextAreaElement || (event.target as Element).closest("[role='listbox']")) return;
          event.preventDefault();
          field.current?.focus();
        }}>
          <Icon name="plus" size={20} className="composer-symbol" />
          <CommandField id="task-entry" inputRef={field} value={text} onChange={onTextChange} label={t.composerPlaceholder} placeholder={example}
            hint={`${t.composerPlaceholder} ${t.composerExample}`}
            sources={{ today, language: locale, tags: suggestions, projects }} usedTags={values.tags} t={t} locale={locale}
            disabled={capturing} describedBy="composer-feedback"
            onKey={(event, shortcuts) => {
              if (shortcuts.includes("submitWithAi")) { event.preventDefault(); void submit(aiEnabled ? "ai" : "add"); }
              else if (shortcuts.includes("submitTask")) { event.preventDefault(); void submit("add"); }
              else if (shortcuts.includes("leaveComposer")) {
                event.preventDefault();
                if (text || choice !== NO_CHOICE) { rewrite(""); setChoice(NO_CHOICE); }
                else onLeave();
              }
            }} />
        </div>
        <button type="submit" className="btn btn-secondary quick-submit" disabled={disabled}>
          {t.add} <Icon name="corner-down-left" size={14} />
        </button>
      </div>
      <ComposerChips t={t} locale={locale} dateFormat={dateFormat} today={today} values={values} projects={projects} savedTags={suggestions}
        disabled={capturing}
        onPriority={(priority) => choose({ ...choice, priority: priority ?? undefined }, "priority")}
        onDue={(due) => choose({ ...choice, due: due ?? undefined }, "due")}
        onPlanned={(plannedFor) => choose({ ...choice, plannedFor })}
        onProject={(projectId) => choose({ ...choice, projectId }, "project")}
        onEstimate={(estimateHours) => choose({ ...choice, estimateHours: estimateHours ?? undefined }, "estimate")}
        onAddTag={(tag) => {
          const next = withTag(choice, tag);
          if (new Set([...values.tags, ...next.tags]).size > MAX_DRAFT_TAGS) setTagLimit(true);
          else setChoice(next);
        }}
        onRemoveTag={(tag) => choose(withoutTag(choice, tag, context.tag), "tag", tag)} />
      <div id="composer-feedback" className="composer-feedback">
        {warnings.map((warning) => <p className="hint" aria-live="polite" key={`${warning.start}-${warning.text}`}>
          <Icon name="info" size={14} />{warning.kind === "date" ? t.composerInvalidDate(warning.text) : t.composerUnknownProject(warning.text)}
        </p>)}
        {problem && <p className="hint is-error" role="alert">{problem.kind === "line_limit" ? t.quickLineLimit
          : problem.kind === "text_limit" ? t.quickTextLimit
            : problem.kind === "tag_limit" ? t.quickTagsOnLine(problem.line) : t.quickInvalidLine("line" in problem ? problem.line : 1)}</p>}
        {tagLimit && <p className="hint is-error" role="alert">{t.composerTagLimit}</p>}
      </div>
      {values.batch && <ComposerBatch drafts={drafts} count={lines} today={today} locale={locale} dateFormat={dateFormat} projects={projects} t={t}
        disabled={capturing} onJoin={() => { rewrite(text.split(/\s*\r?\n\s*/u).filter(Boolean).join(" ")); refocus(); }} />}
      <div className="capture-options">
        <button type="button" className="capture-option" disabled={!aiEnabled || disabled}
          title={aiEnabled ? t.composerHint.replace("{mod}", mod) : t.aiOff} onClick={() => void submit("ai")}>
          <Icon name="list-checks" size={15} />{capturing ? t.creating : t.createWithAi}
          {aiEnabled && <span className="capture-keys" aria-hidden="true"><kbd>{mod}</kbd><kbd>↵</kbd></span>}
        </button>
        {!aiEnabled && <button type="button" className="capture-setup" aria-label={t.aiSetup} title={t.aiSetup}
          aria-expanded={setup} aria-controls="ai-capture-guide" onClick={() => setSetup(!setup)}><Icon name="info" size={15} /></button>}
        <button type="button" className="capture-option capture-help" aria-haspopup="dialog" onClick={() => shortcutsApi.run("help")}>
          <Icon name="keyboard" size={15} />{t.shortcuts.open}
        </button>
      </div>
      {!aiEnabled && <section className="capture-guide" id="ai-capture-guide" aria-label={t.aiSetup} hidden={!setup}>
        <p>{t.aiOff}</p>
        <Link href="/settings#ai-settings-heading">{t.settings}</Link>
      </section>}
    </form>
  );
}
