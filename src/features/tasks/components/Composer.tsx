"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Project } from "@/features/projects/schema";
import { quickAddApi } from "@/features/quick-add/api";
import type { QuickAddDefaults, QuickTask } from "@/features/quick-add/schema";
import { shortcutsApi } from "@/features/shortcuts/api";
import type { Dictionary, Locale } from "@/i18n";
import type { DateFormat } from "@/lib/dates";
import { Icon } from "@/lib/Icon";
import type { ComposerDraft } from "../board-navigation";
import { withoutTag } from "../composer-draft";
import type { SetComposerDraft } from "../use-board-navigation";
import { useComposer } from "../use-composer";
import type { ComposerSubmission } from "../use-composer-submit";
import { CommandField } from "./CommandField";
import { ComposerBatch } from "./ComposerBatch";
import { ComposerChips } from "./ComposerChips";
import { ComposerFeedback } from "./ComposerFeedback";
import "./composer.css";

interface Props {
  t: Dictionary;
  today: string;
  locale: Locale;
  dateFormat: DateFormat;
  draft: ComposerDraft;
  onDraftChange: SetComposerDraft;
  aiEnabled: boolean;
  /** What the current view adds to a new task. */
  context: QuickAddDefaults;
  projects: Project[];
  /** Saved tags. */
  suggestions: string[];
  onSubmit: (submission: ComposerSubmission) => Promise<boolean>;
  onUnsaved: (drafts: QuickTask[]) => void;
  /** Escape on an empty field hands the keyboard back to the list. */
  onLeave: () => void;
  /** Undoes the last completion or deletion while its notice is showing; false when there is nothing to undo. */
  onUndo: () => boolean;
}

/** One field writes the task; the chips under it show and set the same values. */
export function Composer({ t, today, locale, dateFormat, aiEnabled, draft: savedDraft, onDraftChange, onSubmit, onUnsaved, onLeave, onUndo, context, projects, suggestions }: Props) {
  const [setup, setSetup] = useState(false);
  const [mod, setMod] = useState("Ctrl");
  const [caret, setCaret] = useState<number | null>(null);
  const { text } = savedDraft;
  const draft = useComposer({ draft: savedDraft, onDraftChange, today, context, projects, onSubmit, onUnsaved });
  const { field, choice, values, capturing, submit } = draft;
  const lines = text.split(/\r?\n/u).filter((line) => line.trim()).length;
  // Once saving was refused, everything unread is shown, the word under the caret included.
  const warnings = quickAddApi.warnings(text, today, projects, { caret: draft.problem ? null : caret });

  useEffect(() => { setMod(/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl"); }, []);

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
          <CommandField id="task-entry" inputRef={field} value={text} onChange={draft.change} label={t.composerPlaceholder} placeholder={example}
            hint={`${t.composerPlaceholder} ${t.composerExample}`}
            sources={{ today, language: locale, tags: suggestions, projects }} usedTags={values.tags} t={t} locale={locale}
            busy={capturing} describedBy="composer-feedback" onCaret={setCaret}
            onKey={(event, shortcuts) => {
              if (shortcuts.includes("submitWithAi")) { event.preventDefault(); void submit(aiEnabled ? "ai" : "add"); }
              else if (shortcuts.includes("submitTask")) { event.preventDefault(); void submit("add"); }
              // With no text and none of the person's to bring back, the key reaches the list's last action.
              else if (shortcuts.includes("undoFromField") && !text && !draft.hasOwnUndo()) { if (onUndo()) event.preventDefault(); }
              else if (shortcuts.includes("leaveComposer")) {
                event.preventDefault();
                if (draft.pristine) onLeave();
                else draft.clear();
              }
            }} />
        </div>
        <button type="submit" className="btn btn-secondary quick-submit" disabled={draft.disabled || draft.blocked}>
          {t.add} <Icon name="corner-down-left" size={14} />
        </button>
      </div>
      <ComposerChips t={t} locale={locale} dateFormat={dateFormat} today={today} values={values} projects={projects} savedTags={suggestions}
        disabled={capturing}
        onPriority={(priority) => draft.choose({ ...choice, priority: priority ?? undefined }, "priority")}
        // The typed date and time are one token, so the chip keeps whichever of the two the pointer did not change.
        onDue={(due) => draft.choose({ ...choice, due: due ?? undefined, partOfDay: due ? choice.partOfDay ?? values.partOfDay ?? undefined : undefined }, "due")}
        onPartOfDay={(partOfDay) => draft.choose({ ...choice, partOfDay: partOfDay ?? undefined, due: choice.due ?? values.due ?? undefined }, "due")}
        onPlanned={(plannedFor) => draft.choose({ ...choice, plannedFor })}
        onProject={(projectId) => draft.choose({ ...choice, projectId }, "project")}
        onEstimate={(estimateHours) => draft.choose({ ...choice, estimateHours: estimateHours ?? undefined }, "estimate")}
        onRepeat={(repeat) => draft.choose({ ...choice, repeat: repeat ?? undefined })}
        tagInput={choice.tagInput ?? ""} onTagInput={draft.setTagInput} onAddTag={draft.addTag}
        onRemoveTag={(tag) => draft.choose(withoutTag(choice, tag, context.tag), "tag", tag)} />
      {values.batch && <ComposerBatch drafts={draft.drafts} count={lines} today={today} locale={locale} dateFormat={dateFormat} projects={projects} t={t}
        disabled={capturing} blocked={draft.blocked} onJoin={() => { draft.rewrite(text.split(/\s*\r?\n\s*/u).filter(Boolean).join(" ")); draft.refocus(); }} />}
      <div className="capture-options">
        <button type="button" className="capture-option" disabled={!aiEnabled || draft.disabled}
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
      <ComposerFeedback t={t} warnings={warnings} problem={draft.problem} lines={lines} tagLimit={draft.tagLimit} />
    </form>
  );
}
