"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { quickAddApi } from "@/features/quick-add/api";
import type { Dictionary, Locale } from "@/i18n";
import { dueLabel, type DateFormat } from "@/lib/dates";
import { Icon } from "@/lib/Icon";
import "./composer.css";

export type ComposerMode = "add" | "ai";

interface Props {
  t: Dictionary;
  today: string;
  locale: Locale;
  dateFormat: DateFormat;
  text: string;
  onTextChange: (value: string) => void;
  onOpenSettings: () => void;
  aiEnabled: boolean;
  onSubmit: (mode: ComposerMode, text: string) => Promise<boolean>;
}

export function Composer({ t, today, locale, dateFormat, aiEnabled, text, onTextChange, onOpenSettings, onSubmit }: Props) {
  const [busy, setBusy] = useState<ComposerMode | null>(null);
  const [help, setHelp] = useState<"shortcuts" | "ai" | null>(null);
  const [mod, setMod] = useState("Ctrl");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const preview = useMemo(() => quickAddApi.preview(text, today), [text, today]);
  const hasMetadata = preview && (preview.due || preview.priority || preview.tags.length > 0);
  const disabled = !text.trim() || busy !== null;

  useEffect(() => {
    setMod(/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl");
  }, []);

  async function submit(mode: ComposerMode) {
    if (disabled) return;
    setBusy(mode);
    try {
      if (await onSubmit(mode, text.trim())) onTextChange("");
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
        <button type="submit" className="btn btn-primary quick-submit" disabled={disabled}>
          {t.add} <Icon name="corner-down-left" size={14} />
        </button>
      </div>
      {hasMetadata && (
        <ul className="quick-preview" id="quick-task-preview" aria-label={t.quickTaskPreview}>
          {preview.due && <li><Icon name="calendar" size={14} /><span className="sr-only">{t.setDate} </span>{dueLabel(preview.due, today, locale, t, dateFormat)}</li>}
          {preview.priority && <li><Icon name="flag" size={14} /><span className="sr-only">{t.priority} </span>{t[preview.priority]}</li>}
          {preview.tags.map((tag) => <li key={tag}>#{tag}</li>)}
        </ul>
      )}
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
        <a href="/settings?from=tasks#ai-settings-heading" onClick={onOpenSettings}>{t.settings}</a>
      </section>}
    </form>
  );
}
