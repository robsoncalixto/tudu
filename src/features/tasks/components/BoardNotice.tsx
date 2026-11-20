"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "@/i18n";
import { Icon } from "@/lib/Icon";
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

  useEffect(() => {
    // An error stays until it is read; everything else leaves on its own.
    if (!notice || notice.kind === "error" || held) return;
    const timer = window.setTimeout(onDismiss, NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice, held, onDismiss]);

  return <div className={`board-notice${notice ? ` is-${notice.kind}` : ""}`} role="status"
    onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}
    onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
    {notice && <>
      <span className="board-notice-text">{notice.text}</span>
      {notice.action && <button type="button" className="chip" onClick={notice.action.run}>{notice.action.label}</button>}
      <button type="button" className="icon-btn" aria-label={t.dismiss} title={t.dismiss} onClick={onDismiss}><Icon name="x" size={15} /></button>
    </>}
  </div>;
}
