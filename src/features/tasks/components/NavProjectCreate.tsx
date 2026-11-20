"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/i18n";

interface Props {
  t: Dictionary;
  error: string;
  clearError: () => void;
  onCreate: (name: string) => Promise<boolean>;
  /** `settled` is true after a project was created or the person pressed Escape, which hand focus back. */
  onClose: (settled: boolean) => void;
}

/** A project is named right where it will appear in the sidebar: Enter creates it, Escape gives up. */
export function NavProjectCreate({ t, error, clearError, onCreate, onClose }: Props) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);

  return <form className="nav-create" onSubmit={async (event) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const created = await onCreate(name);
    setBusy(false);
    if (created) onClose(true);
    else requestAnimationFrame(() => input.current?.focus());
  }}>
    <input ref={input} className="nav-input" value={name} maxLength={80} readOnly={busy} enterKeyHint="done"
      aria-label={t.newProject} placeholder={t.projectName} aria-invalid={Boolean(error) || undefined}
      aria-describedby={error ? "nav-create-error" : undefined}
      onChange={(event) => { setName(event.target.value); if (error) clearError(); }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.nativeEvent.isComposing) return;
        event.preventDefault();
        event.stopPropagation();
        onClose(true);
      }}
      // A name still being typed is kept; an empty field simply goes away.
      onBlur={() => { if (!name.trim() && !busy) onClose(false); }} />
    {error && <p id="nav-create-error" role="alert">{error}</p>}
  </form>;
}
