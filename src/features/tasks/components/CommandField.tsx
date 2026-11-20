"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { quickAddApi } from "@/features/quick-add/api";
import type { QuickSuggestion, SuggestionSources } from "@/features/quick-add/schema";
import { shortcutsApi } from "@/features/shortcuts/api";
import type { ShortcutId } from "@/features/shortcuts/schema";
import type { Dictionary, Locale } from "@/i18n";
import { dayChoiceLabel } from "@/lib/dates";
import type { Priority } from "../schema";
import { Icon, type IconName } from "@/lib/Icon";
import { replaceFieldText } from "@/lib/text-field";
import "./command-field.css";

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  /** Shown while the field is empty. `hint` is the same guidance as plain text. */
  placeholder?: ReactNode;
  hint?: string;
  sources: SuggestionSources;
  /** Tags the draft already carries, which are not offered again. */
  usedTags?: readonly string[];
  t: Dictionary;
  locale: Locale;
  disabled?: boolean;
  describedBy?: string;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  /** Keys the suggestions did not use, with the shortcuts they are bound to. */
  onKey?: (event: KeyboardEvent<HTMLTextAreaElement>, shortcuts: ShortcutId[]) => void;
  onBlur?: () => void;
}

const ICONS: Record<QuickSuggestion["kind"], IconName> = { tag: "tag", create: "plus", project: "folder", due: "calendar", priority: "flag" };

/** A text field that highlights the quick-add tokens it recognizes and completes the one being typed. */
export function CommandField({ id, value, onChange, label, placeholder, hint, sources, usedTags, t, locale, disabled, describedBy, inputRef, onKey, onBlur }: Props) {
  const listId = useId();
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const field = inputRef ?? ownRef;
  const [caret, setCaret] = useState<number | null>(null);
  const [picked, setPicked] = useState({ at: "", index: 0, moved: false });
  const [dismissed, setDismissed] = useState("");
  const completion = caret === null || disabled ? null : quickAddApi.completion(value, caret);
  const at = completion ? `${completion.start}:${completion.trigger}${completion.query}` : "";
  const word = completion ? value.slice(completion.start, completion.end) : "";
  const found = completion && dismissed !== `${completion.start}:${completion.trigger}` ? quickAddApi.suggestions(completion, sources, usedTags) : [];
  // A lone suggestion that repeats what was typed has nothing to add.
  const items = found.length === 1 && quickAddApi.isTyped(word, found[0], sources) ? [] : found;
  const index = picked.at === at ? Math.min(picked.index, items.length - 1) : 0;
  const open = items.length > 0;

  const marks = [
    ...quickAddApi.tokens(value, sources.today, sources.projects).map((token) => ({ ...token, known: true })),
    ...quickAddApi.warnings(value, sources.today, sources.projects).map((warning) => ({ ...warning, known: false })),
  ].sort((a, b) => a.start - b.start);
  const mirror: ReactNode[] = [];
  let cursor = 0;
  for (const mark of marks) {
    mirror.push(value.slice(cursor, mark.start), <span key={mark.start} className={mark.known ? "command-token" : "command-unknown"}>{value.slice(mark.start, mark.end)}</span>);
    cursor = mark.end;
  }

  function accept(suggestion: QuickSuggestion) {
    const input = field.current;
    if (!completion || !input) return;
    const text = /^\s/u.test(value.slice(completion.end)) ? suggestion.insert : `${suggestion.insert} `;
    if (!replaceFieldText(input, completion.start, completion.end, text)) {
      onChange(value.slice(0, completion.start) + text + value.slice(completion.end));
    }
    setCaret(input.selectionStart);
  }

  /** What the suggestion means, and beside it what will be written when that says more. */
  function describe(suggestion: QuickSuggestion): [string, string?] {
    if (suggestion.kind === "tag") return [suggestion.insert];
    if (suggestion.kind === "create") return [suggestion.insert, t.newTag];
    if (suggestion.kind === "priority") return [t[suggestion.value as Priority], suggestion.insert];
    if (suggestion.kind === "project") return [suggestion.label, suggestion.insert];
    const day = dayChoiceLabel(suggestion.value, sources.today, locale, t);
    return [suggestion.time ? `${day} · ${suggestion.time}` : day, suggestion.insert];
  }

  return <div className="command-field">
    <div className="command-mirror" aria-hidden="true">
      {value ? <>{mirror}{value.slice(cursor)}{"​"}</> : <span className="command-placeholder">{placeholder}</span>}
    </div>
    <textarea id={id} ref={field} value={value} rows={1} disabled={disabled} spellCheck placeholder={hint}
      role="combobox" aria-label={label} aria-describedby={describedBy} aria-autocomplete="list" aria-haspopup="listbox"
      aria-expanded={open} aria-controls={listId} aria-activedescendant={open ? `${listId}-${index}` : undefined}
      onChange={(event) => { onChange(event.target.value); setCaret(event.target.selectionStart); }}
      onSelect={(event) => setCaret(event.currentTarget.selectionStart === event.currentTarget.selectionEnd ? event.currentTarget.selectionStart : null)}
      onBlur={() => { setCaret(null); onBlur?.(); }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        const shortcuts = shortcutsApi.match("composer", event);
        if (open) {
          const step = shortcuts.includes("nextSuggestion") ? 1 : shortcuts.includes("previousSuggestion") ? -1 : 0;
          if (step) {
            event.preventDefault();
            setPicked({ at, index: (index + step + items.length) % items.length, moved: true });
            return;
          }
          // Enter on a token that is already complete belongs to the form, unless the person chose another suggestion.
          const typed = event.key === "Enter" && !(picked.at === at && picked.moved) && quickAddApi.isTyped(word, items[index], sources);
          if (shortcuts.includes("acceptSuggestion") && !typed) { event.preventDefault(); accept(items[index]); return; }
          if (shortcuts.includes("leaveComposer") && completion) {
            event.preventDefault();
            event.stopPropagation();
            setDismissed(`${completion.start}:${completion.trigger}`);
            return;
          }
        }
        onKey?.(event, shortcuts);
      }} />
    <ul id={listId} role="listbox" aria-label={t.suggestionList} className="command-suggestions" hidden={!open}>
      {items.map((suggestion, position) => {
        const [meaning, written] = describe(suggestion);
        return <li key={suggestion.insert} id={`${listId}-${position}`} role="option" aria-selected={position === index}
          onPointerDown={(event) => event.preventDefault()} onClick={() => accept(suggestion)}>
          <Icon name={ICONS[suggestion.kind]} size={15} /><span>{meaning}</span>{written && <code>{written}</code>}
        </li>;
      })}
    </ul>
    <div className="sr-only" aria-live="polite">{open ? t.suggestionCount(items.length) : ""}</div>
  </div>;
}
