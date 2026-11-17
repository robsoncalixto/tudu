"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/i18n";

export type ComposerMode = "add" | "ai";

interface Props {
  t: Dictionary;
  aiEnabled: boolean;
  /** Resolves true when the text was turned into tasks, so the field can be cleared. */
  onSubmit: (mode: ComposerMode, text: string) => Promise<boolean>;
}

export function Composer({ t, aiEnabled, onSubmit }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<ComposerMode | null>(null);
  const [mod, setMod] = useState("Ctrl");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMod(/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl");
  }, []);

  async function submit(mode: ComposerMode) {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(mode);
    try {
      if (await onSubmit(mode, value)) setText("");
    } finally {
      setBusy(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  const empty = !text.trim();

  return (
    <form
      className="card composer"
      onSubmit={(event) => {
        event.preventDefault();
        submit("add");
      }}
    >
      <textarea
        ref={inputRef}
        value={text}
        rows={Math.min(8, Math.max(2, text.split("\n").length))}
        placeholder={t.composerPlaceholder}
        aria-label={t.composerPlaceholder}
        disabled={busy !== null}
        autoFocus
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          submit((event.metaKey || event.ctrlKey) && aiEnabled ? "ai" : "add");
        }}
      />
      <div className="composer-bar">
        <p className="hint">{aiEnabled ? t.composerHint.replace("{mod}", mod) : t.aiOff}</p>
        <div className="composer-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!aiEnabled || empty || busy !== null}
            onClick={() => submit("ai")}
          >
            <span className="spark" aria-hidden>
              ✦
            </span>
            {busy === "ai" ? t.creating : t.createWithAi}
          </button>
          <button type="submit" className="btn btn-primary" disabled={empty || busy !== null}>
            {t.add}
          </button>
        </div>
      </div>
      {busy === "ai" && <div className="composer-progress" aria-hidden />}
    </form>
  );
}
