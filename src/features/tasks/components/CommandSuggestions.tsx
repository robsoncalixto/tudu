"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { QuickSuggestion } from "@/features/quick-add/schema";
import type { Dictionary, Locale } from "@/i18n";
import { dayChoiceLabel } from "@/lib/dates";
import { Icon, type IconName } from "@/lib/Icon";
import { placeBelow } from "@/lib/popover";
import { useSettled } from "@/lib/use-settled";
import type { Priority } from "../schema";

interface Props {
  id: string;
  /** The field the list belongs to. */
  field: RefObject<HTMLTextAreaElement | null>;
  /** The field's text, which moves the list as it grows. */
  value: string;
  items: QuickSuggestion[];
  /** The highlighted suggestion. */
  index: number;
  today: string;
  t: Dictionary;
  locale: Locale;
  onAccept: (suggestion: QuickSuggestion) => void;
}

const ICONS: Record<QuickSuggestion["kind"], IconName> = { tag: "tag", create: "plus", project: "folder", due: "calendar", priority: "flag" };

/** What can complete the token being typed, listed under the field that owns it. */
export function CommandSuggestions({ id, field, value, items, index, today, t, locale, onAccept }: Props) {
  const list = useRef<HTMLUListElement>(null);
  const open = items.length > 0;
  // Read out once the typing pauses, not at every key.
  const count = useSettled(open ? t.suggestionCount(items.length) : "", 600);

  // The list sits in the top layer under the field, so a list or panel that clips its content cannot cut it.
  useLayoutEffect(() => {
    const popup = list.current;
    const input = field.current;
    if (!popup || !input || typeof popup.showPopover !== "function") return;
    if (!open) { if (popup.matches(":popover-open")) popup.hidePopover(); return; }
    // Under the box that scrolls, not under the whole text, which can be taller than what shows.
    const place = () => placeBelow(popup, (input.parentElement ?? input).getBoundingClientRect());
    if (!popup.matches(":popover-open")) popup.showPopover();
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, value, items.length, field]);

  useEffect(() => {
    if (open) document.getElementById(`${id}-${index}`)?.scrollIntoView({ block: "nearest" });
  }, [open, index, id]);

  /** What the suggestion means, and beside it what will be written when that says more. */
  function describe(suggestion: QuickSuggestion): [string, string?] {
    if (suggestion.kind === "tag") return [suggestion.insert];
    if (suggestion.kind === "create") return [suggestion.insert, t.newTag];
    if (suggestion.kind === "priority") return [t[suggestion.value as Priority], suggestion.insert];
    if (suggestion.kind === "project") return [suggestion.label, suggestion.insert];
    const day = dayChoiceLabel(suggestion.value, today, locale, t);
    return [suggestion.time ? `${day} · ${suggestion.time}` : day, suggestion.insert];
  }

  return <>
    <ul ref={list} id={id} role="listbox" aria-label={t.suggestionList} className="command-suggestions" popover="manual">
      {items.map((suggestion, position) => {
        const [meaning, written] = describe(suggestion);
        return <li key={suggestion.insert} id={`${id}-${position}`} role="option" aria-selected={position === index}
          onPointerDown={(event) => event.preventDefault()} onClick={() => onAccept(suggestion)}>
          <Icon name={ICONS[suggestion.kind]} size={15} /><span>{meaning}</span>{written && <code>{written}</code>}
        </li>;
      })}
    </ul>
    <div className="sr-only" aria-live="polite">{count}</div>
  </>;
}
