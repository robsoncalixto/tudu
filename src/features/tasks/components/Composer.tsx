"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "@/features/projects/schema";
import { normalizeQuickTag, type QuickAddDefaults, type QuickAddProblem } from "@/features/quick-add/schema";
import { quickAddApi } from "@/features/quick-add/api";
import type { Dictionary, Locale } from "@/i18n";
import type { DateFormat } from "@/lib/dates";
import { Icon } from "@/lib/Icon";
import type { Priority } from "../schema";
import { ComposerDetails } from "./ComposerDetails";
import { ComposerPreview, type PreviewDraft } from "./ComposerPreview";
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
  defaultPriority: Priority;
  context: QuickAddDefaults;
  projects: Project[];
  suggestions: string[];
  onSubmit: (mode: ComposerMode, text: string, defaults: QuickAddDefaults) => Promise<boolean>;
}

export function Composer({ t, today, locale, dateFormat, aiEnabled, text, onTextChange, onSubmit, defaultPriority, context, projects, suggestions }: Props) {
  const [busy, setBusy] = useState<ComposerMode | null>(null);
  const [help, setHelp] = useState<"shortcuts" | "ai" | null>(null);
  const [mod, setMod] = useState("Ctrl");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [chosen, setChosen] = useState<{ priority?: Priority; due?: string; tags: string[] }>({ tags: [] });
  const [tag, setTag] = useState("");
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [problem, setProblem] = useState<QuickAddProblem | null>(null);
  const [tagLimit, setTagLimit] = useState(false);
  const defaults = { ...context, ...chosen, tags: [...new Set([...chosen.tags, normalizeQuickTag(tag)].filter(Boolean))] };
  const drafts = useMemo(() => quickAddApi.previewDrafts(text, today, defaults, projects), [text, today, context, chosen, tag, projects]);
  const selectedPriority = drafts?.every((item) => item.priority === drafts[0].priority) ? drafts[0].priority : chosen.priority;
  const selectedDue = drafts?.every((item) => item.due === drafts[0].due) ? drafts[0].due : chosen.due;
  const emptyPreview: PreviewDraft = { title: "", tags: defaults.tags, projectId: null, due: chosen.due ?? null, priority: chosen.priority };
  const preview = drafts ?? [emptyPreview];
  const hasMetadata = preview.length > 1 || preview.some((item) => item.due || item.priority || item.projectId || item.estimateHours || item.tags.length);

  function addTag() {
    const value = normalizeQuickTag(tag);
    if (!value) return;
    const saved = quickAddApi.previewDrafts(text, today, { ...context, ...chosen }, projects);
    const current = saved ?? [{ tags: [...chosen.tags, ...(context.tag ? [context.tag] : [])] }];
    if (current.some((item) => new Set([...item.tags.map(normalizeQuickTag), value]).size > 10)) {
      setTagLimit(true);
      return;
    }
    setChosen({ ...chosen, tags: [...new Set([...chosen.tags, value])] });
    setTag("");
    setTagLimit(false);
  }

  function removeTag(value: string) {
    setChosen({ ...chosen, tags: chosen.tags.filter((item) => item !== value) });
    if (normalizeQuickTag(tag) === value) setTag("");
    setTagLimit(false);
    onTextChange(quickAddApi.stripTokens(text, today, projects, "tag", value));
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }
  const disabled = !text.trim() || busy !== null;

  useEffect(() => {
    setMod(/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl");
  }, []);

  useEffect(() => { setProblem(null); }, [text, chosen, tag]);

  async function submit(mode: ComposerMode) {
    if (disabled) return;
    if (new Set([...defaults.tags, ...(context.tag ? [context.tag] : [])]).size > 10) {
      setTagLimit(true);
      return;
    }
    if (mode === "add") setProblem(drafts ? null : quickAddApi.problem(text, today, defaults, projects));
    setBusy(mode);
    try {
      if (await onSubmit(mode, text.trim(), defaults)) {
        onTextChange("");
        setChosen({ tags: [] });
        setTag("");
        setTagLimit(false);
        setDetailsExpanded(false);
      }
    } finally {
      setBusy(null);
      requestAnimationFrame(() => {
        const input = inputRef.current;
        if (document.activeElement === document.body || input?.form?.contains(document.activeElement)) {
          input?.focus({ preventScroll: true });
        }
      });
    }
  }

  return (
    <form className="composer quick-composer" onSubmit={(event) => { event.preventDefault(); void submit("add"); }}>
      <div className="composer-entry">
        <label className="composer-field" htmlFor="task-entry">
          <Icon name="plus" size={20} className="composer-symbol" />
          <textarea
            id="task-entry" ref={inputRef} value={text}
            rows={Math.min(8, text.split("\n").length)} placeholder={t.composerPlaceholder}
            aria-label={t.composerPlaceholder} aria-describedby={hasMetadata ? "quick-task-preview" : undefined}
            disabled={busy !== null}
            onChange={(event) => onTextChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              void submit((event.metaKey || event.ctrlKey) && aiEnabled ? "ai" : "add");
            }}
          />
        </label>
        <button type="button" className="composer-mobile-details icon-btn" aria-label={t.composerDetails}
          title={t.composerDetails} aria-expanded={detailsExpanded} aria-controls="composer-task-details"
          onClick={() => setDetailsExpanded(!detailsExpanded)}><Icon name="settings" size={17} /></button>
        <button type="submit" className="btn btn-primary quick-submit" disabled={disabled}>
          {t.add} <Icon name="corner-down-left" size={14} />
        </button>
      </div>
      <div className="composer-fields" id="composer-task-details" data-expanded={detailsExpanded}>
        <ComposerDetails t={t} priority={selectedPriority ?? defaultPriority} due={selectedDue ?? ""} tag={tag}
        suggestions={suggestions} busy={busy !== null} onTag={(value) => { setTag(value); setTagLimit(false); }} onAddTag={addTag}
        onPriority={(priority) => {
          setChosen({ ...chosen, priority }); onTextChange(quickAddApi.stripTokens(text, today, projects, "priority"));
        }}
        onDue={(due) => {
          setChosen({ ...chosen, due: due || undefined }); onTextChange(quickAddApi.stripTokens(text, today, projects, "due"));
        }} />
      </div>
      {problem && <p className="hint" role="alert">{problem.kind === "line_limit" ? t.quickLineLimit
        : problem.kind === "text_limit" ? t.quickTextLimit
          : problem.kind === "tag_limit" ? t.quickTagsOnLine(problem.line) : t.quickInvalidLine("line" in problem ? problem.line : 1)}</p>}
      {tagLimit && <p className="hint" role="alert">{t.composerTagLimit}</p>}
      {hasMetadata && <ComposerPreview drafts={preview} today={today} locale={locale} dateFormat={dateFormat}
        projects={projects} fixedTag={context.tag} t={t} onRemoveTag={removeTag} />}
      <div className="capture-options">
        <button type="button" className="capture-option" disabled={!aiEnabled || disabled}
          title={aiEnabled ? t.composerHint.replace("{mod}", mod) : t.aiOff}
          onClick={() => void submit("ai")}>
          <Icon name="list-checks" size={15} />{busy === "ai" ? t.creating : t.createWithAi}
        </button>
        {!aiEnabled && <button type="button" className="capture-setup" aria-label={t.aiSetup} title={t.aiSetup}
          aria-expanded={help === "ai"} aria-controls="ai-capture-guide"
          onClick={() => setHelp(help === "ai" ? null : "ai")}><Icon name="info" size={15} /></button>}
        <button type="button" className="capture-option capture-help" aria-expanded={help === "shortcuts"}
          aria-controls="quick-task-guide" onClick={() => setHelp(help === "shortcuts" ? null : "shortcuts")}>
          <Icon name="keyboard" size={15} />{t.shortSyntaxTitle}<Icon name="chevron-down" size={13} />
        </button>
      </div>
      <div className="capture-guide" id="quick-task-guide" hidden={help !== "shortcuts"}>
        <code>{t.quickTaskExample}</code>
        <p>{t.shortSyntaxHint}</p>
        {aiEnabled && <p>{t.composerHint.replace("{mod}", mod)}</p>}
      </div>
      {!aiEnabled && <section className="capture-guide" id="ai-capture-guide" aria-label={t.aiSetup} hidden={help !== "ai"}>
        <p>{t.aiOff}</p>
        <Link href="/settings#ai-settings-heading">{t.settings}</Link>
      </section>}
    </form>
  );
}
