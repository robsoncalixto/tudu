"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { normalizeQuickTag } from "@/features/quick-add/schema";
import type { Dictionary } from "@/i18n";
import { Icon } from "@/lib/Icon";
import { placeBelow } from "@/lib/popover";

interface Props {
  t: Dictionary;
  /** Tags the task being written already has. */
  tags: string[];
  /** Saved tags that can be reused. */
  saved: string[];
  disabled?: boolean;
  text: string;
  onTextChange?: (value: string) => void;
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}

/** The tags of the task being written, with a search that reuses saved tags or creates one. */
export function TagPicker({ t, tags, saved, disabled, text, onTextChange, onAdd, onRemove }: Props) {
  const id = useId();
  const popup = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const typed = normalizeQuickTag(text);
  const matches = saved.filter((tag) => !tags.includes(tag) && tag.includes(typed)).slice(0, 6);
  const options = typed && !saved.includes(typed) && !tags.includes(typed) ? [...matches, typed] : matches;
  const index = Math.min(active, options.length - 1);

  useLayoutEffect(() => {
    const anchor = trigger.current?.getBoundingClientRect();
    if (!open || !popup.current || !anchor || typeof popup.current.showPopover !== "function") return;
    if (!popup.current.matches(":popover-open")) popup.current.showPopover();
    placeBelow(popup.current, anchor);
    input.current?.focus({ preventScroll: true });
  }, [open]);

  function toggle(next: boolean) {
    if (next === open) return;
    setOpen(next);
    setActive(0);
    if (!next && popup.current?.matches(":popover-open")) popup.current.hidePopover();
  }

  function add(tag: string | undefined) {
    if (!tag) return;
    onAdd(tag);
    setActive(0);
  }

  return <>
    <span className="composer-chip">
      <button ref={trigger} type="button" className="chip-main" disabled={disabled}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={id} aria-label={t.tags} title={t.tags}
        onPointerDown={() => { wasOpen.current = open; }} onPointerCancel={() => { wasOpen.current = false; }}
        onClick={(event) => {
          const dismissed = event.detail > 0 && wasOpen.current;
          wasOpen.current = false;
          toggle(!(open || dismissed));
        }}>
        <Icon name="tag" size={15} /><span className="chip-text">{t.tags}</span>
      </button>
      <div ref={popup} id={id} popover="auto" role="dialog" aria-label={t.tags} className="chip-menu tag-picker"
        onBeforeToggle={(event) => { if (event.newState === "closed") toggle(false); }}>
        <>
          <input ref={input} className="form-control" value={text} maxLength={40} placeholder={t.composerTag}
            role="combobox" aria-label={t.composerTag} aria-autocomplete="list" aria-expanded={options.length > 0}
            aria-controls={`${id}-list`} aria-activedescendant={options.length ? `${id}-${index}` : undefined}
            onChange={(event) => { onTextChange?.(event.target.value); setActive(0); }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                if (options.length) setActive((index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
              } else if (event.key === "Enter") {
                event.preventDefault();
                add(options[index] ?? typed);
              }
            }} />
          <ul id={`${id}-list`} role="listbox" aria-label={t.suggestionList}>
            {options.map((tag, position) => <li key={tag} id={`${id}-${position}`} role="option" aria-selected={position === index}
              onPointerDown={(event) => event.preventDefault()} onClick={() => add(tag)}>
              <Icon name={saved.includes(tag) ? "tag" : "plus"} size={15} /><span>#{tag}</span>
              {!saved.includes(tag) && <code>{t.newTag}</code>}
            </li>)}
          </ul>
        </>
      </div>
    </span>
    {tags.map((tag) => <span className="composer-chip" data-filled key={tag}>
      <span className="chip-main chip-text">#{tag}</span>
      <button type="button" className="chip-clear" aria-label={t.composerRemoveTag(tag)} title={t.composerRemoveTag(tag)}
        disabled={disabled} onClick={() => onRemove(tag)}><Icon name="x" size={13} /></button>
    </span>)}
  </>;
}
