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
  // Where the keyboard was before it came into the notice, to go back there when the notice is dismissed.
  const cameFrom = useRef<HTMLElement | null>(null);
  const undoKey = characters ? shortcutsApi.keys("global", false).find(({ id }) => id === "undo")?.caps.join("+") : undefined;

  useEffect(() => {
    // An error stays until it is read; everything else leaves on its own.
    if (!notice || notice.kind === "error" || held) return;
    const timer = window.setTimeout(onDismiss, NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice, held, onDismiss]);

  return <div className={`board-notice${notice ? ` is-${notice.kind}` : ""}`} role="status"
    onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}
    onFocus={(event) => {
      setHeld(true);
      if (!event.currentTarget.contains(event.relatedTarget)) cameFrom.current = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
    }}
    onBlur={() => setHeld(false)}>
    {notice && <>
      <span className="board-notice-text">{notice.text}</span>
      {notice.undo && <button type="button" className="chip" aria-keyshortcuts={undoKey} onClick={notice.undo}>
        {t.undo}{undoKey && <kbd aria-hidden="true">{undoKey}</kbd>}
      </button>}
      {notice.action && <button type="button" className="chip" onClick={notice.action.run}>{notice.action.label}</button>}
      <button type="button" className="icon-btn" aria-label={t.dismiss} title={t.dismiss} onClick={(event) => {
        // The button is about to go: the keyboard returns to where it was, or to the board.
        const inside = event.currentTarget.parentElement?.contains(document.activeElement);
        onDismiss();
        if (inside) (cameFrom.current?.isConnected ? cameFrom.current : document.getElementById("main-content"))?.focus();
      }}><Icon name="x" size={15} /></button>
    </>}
  </div>;
}
