"use client";

import { useEffect, useRef, useState } from "react";
import type { Project } from "@/features/projects/schema";
import { quickAddApi } from "@/features/quick-add/api";
import type { QuickAddDefaults, QuickAddProblem, QuickTokenType } from "@/features/quick-add/schema";
import { replaceFieldText } from "@/lib/text-field";
import { composerDefaults, composerValues, MAX_DRAFT_TAGS, NO_CHOICE, withTag, type ComposerChoice } from "./composer-draft";
import type { ComposerMode } from "./use-composer-submit";

interface Options {
  text: string;
  onTextChange: (value: string) => void;
  today: string;
  /** What the current view adds to a new task. */
  context: QuickAddDefaults;
  projects: Project[];
  onSubmit: (mode: ComposerMode, text: string, defaults: QuickAddDefaults) => Promise<boolean>;
}

/** The task being written: its text, the values picked with chips, and what happens when it is sent. */
export function useComposer({ text, onTextChange, today, context, projects, onSubmit }: Options) {
  const [capturing, setCapturing] = useState(false);
  const [choice, setChoice] = useState<ComposerChoice>(NO_CHOICE);
  const [problem, setProblem] = useState<QuickAddProblem | null>(null);
  const [tagLimit, setTagLimit] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const current = useRef(text);
  current.current = text;
  const defaults = composerDefaults(context, choice);
  const values = composerValues(text, today, defaults, projects);
  const drafts = quickAddApi.previewDrafts(text, today, defaults, projects);
  const disabled = !text.trim() || capturing;

  useEffect(() => { setProblem(null); setTagLimit(false); }, [text, choice]);

  const refocus = () => requestAnimationFrame(() => field.current?.focus({ preventScroll: true }));
  /** Changes the text as typing would, so the browser can undo it. */
  function rewrite(next: string) {
    const input = field.current;
    if (!input || !replaceFieldText(input, 0, input.value.length, next)) onTextChange(next);
  }
  /** A chip takes over its field: the typed token goes and the chip keeps the value. */
  function choose(next: ComposerChoice, type?: QuickTokenType, value?: string) {
    setChoice(next);
    const stripped = type && !values.batch ? quickAddApi.stripTokens(text, today, projects, type, value) : text;
    if (stripped !== text) rewrite(stripped);
    refocus();
  }
  function addTag(tag: string) {
    const next = withTag(choice, tag);
    if (new Set([...values.tags, ...next.tags]).size > MAX_DRAFT_TAGS) setTagLimit(true);
    else setChoice(next);
  }
  function clear() {
    rewrite("");
    setChoice(NO_CHOICE);
  }

  async function submit(mode: ComposerMode) {
    if (disabled) return;
    if (values.tags.length > MAX_DRAFT_TAGS) { setTagLimit(true); return; }
    const sent = { text, choice };
    if (mode === "ai") {
      setCapturing(true);
      try { if (await onSubmit("ai", text.trim(), defaults)) { onTextChange(""); setChoice(NO_CHOICE); } }
      finally { setCapturing(false); refocus(); }
      return;
    }
    if (!drafts) {
      setProblem(quickAddApi.problem(text, today, defaults, projects));
      void onSubmit("add", text.trim(), defaults);
      return;
    }
    // The field is free for the next task at once; a failed save brings this one back.
    onTextChange("");
    setChoice(NO_CHOICE);
    refocus();
    if (await onSubmit("add", sent.text.trim(), defaults)) return;
    onTextChange(current.current.trim() ? `${sent.text}\n${current.current}` : sent.text);
    setChoice(sent.choice);
  }

  return {
    field, choice, values, drafts, disabled, capturing, problem, tagLimit, pristine: !text && choice === NO_CHOICE,
    rewrite, refocus, choose, addTag, clear, submit,
  };
}
