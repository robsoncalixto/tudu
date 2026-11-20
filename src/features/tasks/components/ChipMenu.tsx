"use client";

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@/lib/Icon";
import { placeBelow } from "@/lib/popover";

export interface ChipOption {
  key: string;
  label: string;
  /** Leave undefined for an action that is not one of the values. */
  checked?: boolean;
  /** A key that picks this option while the menu is open. */
  hotkey?: string;
  onSelect: () => void;
}

interface Props {
  icon: IconName;
  label: string;
  /** The current value in words, or null while the chip is empty. */
  value: string | null;
  /** Extra explanation for the value, shown as a tooltip and read after the name. */
  note?: string;
  /** Keeps the label beside the value, for a chip whose value another chip can show too. */
  labelled?: boolean;
  options: ChipOption[];
  /** A second set of choices under the first, for a value that goes with it. */
  more?: { label: string; options: ChipOption[] };
  clearLabel: string;
  onClear: () => void;
  disabled?: boolean;
  children?: ReactNode;
}

/** A chip that names one field of the task being written and opens a menu to set it. */
export function ChipMenu({ icon, label, value, note, labelled, options, more, clearLabel, onClear, disabled, children }: Props) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const wasOpen = useRef(false);
  const [open, setOpen] = useState(false);

  // Opening in the same turn as the click keeps the menu ready for the very next key.
  useLayoutEffect(() => {
    const popup = menu.current;
    const anchor = trigger.current?.getBoundingClientRect();
    if (!open || !popup || !anchor || typeof popup.showPopover !== "function") return;
    if (!popup.matches(":popover-open")) popup.showPopover();
    placeBelow(popup, anchor);
    // An empty chip starts at the top of its choices; a set one, at the choice it holds.
    ((value !== null && popup.querySelector<HTMLElement>("[aria-checked='true']")) || popup.querySelector<HTMLElement>("button"))?.focus({ preventScroll: true });
  }, [open]);

  function close() {
    if (menu.current?.matches(":popover-open")) menu.current.hidePopover();
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    if (event.key === "Tab") { close(); return; }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const hot = items.find((item) => item.dataset.hotkey === event.key);
    if (hot) { event.preventDefault(); hot.click(); return; }
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = event.key === "ArrowDown" ? (index + 1) % items.length
      : event.key === "ArrowUp" ? (index - 1 + items.length) % items.length
      : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : -1;
    if (next === -1 && event.key.length === 1 && event.key !== " ") {
      // Typing the start of a name jumps to it, as in a native menu.
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : "") + event.key.toLocaleLowerCase(), at: now };
      next = items.findIndex((item) => item.textContent?.toLocaleLowerCase().startsWith(typed.current.text));
    }
    if (next >= 0) { event.preventDefault(); items[next].focus(); }
  }

  return <span className="composer-chip" data-filled={value !== null || undefined}>
    <button ref={trigger} type="button" className="chip-main" disabled={disabled}
      aria-haspopup="menu" aria-expanded={open} aria-controls={id} aria-label={value === null ? label : `${label}: ${value}`}
      aria-description={note} title={note ?? label}
      onPointerDown={() => { wasOpen.current = open; }} onPointerCancel={() => { wasOpen.current = false; }}
      onClick={(event) => {
        // A pointer press outside the menu already closed it; the click must not open it again.
        const dismissed = event.detail > 0 && wasOpen.current;
        wasOpen.current = false;
        if (open || dismissed) close();
        else setOpen(true);
      }}>
      <Icon name={icon} size={15} /><span className="chip-text">{value === null ? label : labelled ? `${label}: ${value}` : value}</span>
    </button>
    {value !== null && <button type="button" className="chip-clear" aria-label={clearLabel} title={clearLabel}
      disabled={disabled} onClick={onClear}><Icon name="x" size={13} /></button>}
    <div ref={menu} id={id} popover="auto" role="menu" aria-label={label} className="chip-menu"
      onBeforeToggle={(event) => { if (event.newState === "closed") setOpen(false); }} onKeyDown={onKeyDown}>
      {/* Always rendered: removing the focused option while the menu closes would lose the way back to the chip. */}
      {[{ label, options }, ...(more ? [more] : [])].map((group, position) => <div key={group.label} role="group" aria-label={group.label}>
        {position > 0 && <p aria-hidden="true">{group.label}</p>}
        {group.options.map((option) => <button key={option.key} type="button" tabIndex={-1} data-hotkey={option.hotkey}
          role={option.checked === undefined ? "menuitem" : "menuitemradio"} aria-checked={option.checked} aria-keyshortcuts={option.hotkey}
          onClick={() => { close(); option.onSelect(); }}>
          <span>{option.label}</span>{option.hotkey && <kbd aria-hidden="true">{option.hotkey}</kbd>}
          {option.checked && <Icon name="check" size={15} />}
        </button>)}
      </div>)}
    </div>
    {children}
  </span>;
}
