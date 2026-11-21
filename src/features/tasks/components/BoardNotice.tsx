"use client";

import { useEffect, useRef, useState } from "react";
import { shortcutsApi } from "@/features/shortcuts/api";
import type { Dictionary } from "@/i18n";
import { Icon } from "@/lib/Icon";
import { useCharacterKeys } from "../use-character-keys";
import type { Notice } from "../use-notice";

/** Long enough to read and reach Undo; hovering or focusing the notice stops the clock. */
const NOTICE_MS = 6000;

interface Props {
  notice: Notice;
  t: Dictionary;
  onDismiss: () => void;
}

/** What just happened on the board, with Undo when the action can be reversed. It floats, so the list never jumps. */
export function BoardNotice({ notice, t, onDismiss }: Props) {
  const [held, setHeld] = useState(false);
  const characters = useCharacterKeys();
  const box = useRef<HTMLDivElement>(null);
  // Where the keyboard was when the notice came up: the place to return to when one of its buttons goes away.
  const origin = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!notice) return;
    const remember = () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body && !box.current?.contains(active)) origin.current = active;
    };
    remember();
    // The action that raised the notice may still be moving the keyboard on to the next row.
    const frame = requestAnimationFrame(remember);
    return () => cancelAnimationFrame(frame);
  }, [notice]);
  /** Runs a button of the notice. If the button went away with it, the keyboard goes back instead of nowhere. */
  const act = (run: () => void) => () => {
    const inside = box.current?.contains(document.activeElement);
    run();
    if (inside) requestAnimationFrame(() => {
      if (document.activeElement !== document.body) return;
      (origin.current?.isConnected ? origin.current : document.getElementById("main-content"))?.focus();
    });
  };
  const undoKey = characters ? shortcutsApi.keys("global", false).find(({ id }) => id === "undo")?.caps.join("+") : undefined;

  useEffect(() => {
    // An error stays until it is read; everything else leaves on its own.
    if (!notice || notice.kind === "error" || held) return;
    const timer = window.setTimeout(onDismiss, NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice, held, onDismiss]);

  return <div ref={box} className={`board-notice${notice ? ` is-${notice.kind}` : ""}`} role="status"
    onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}
    onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
    {notice && <>
      <span className="board-notice-text" title={notice.text}>{notice.text}</span>
      {notice.undo && <button type="button" className="chip" aria-keyshortcuts={undoKey} onClick={act(notice.undo)}>
        {t.undo}{undoKey && <kbd aria-hidden="true">{undoKey}</kbd>}
      </button>}
      {notice.action && <button type="button" className="chip" onClick={act(notice.action.run)}>{notice.action.label}</button>}
      <button type="button" className="icon-btn" aria-label={t.dismiss} title={t.dismiss} onClick={act(onDismiss)}><Icon name="x" size={15} /></button>
    </>}
  </div>;
}
