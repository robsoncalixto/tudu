"use client";

import { useEffect, useRef, useState } from "react";
import type { Project } from "@/features/projects/schema";
import { quickAddApi } from "@/features/quick-add/api";
import type { QuickAddDefaults, QuickAddProblem, QuickTask, QuickTokenType } from "@/features/quick-add/schema";
import { replaceFieldText } from "@/lib/text-field";
import type { ComposerDraft } from "./board-navigation";
import { composerDefaults, composerValues, MAX_DRAFT_TAGS, NO_CHOICE, withTag, type ComposerChoice } from "./composer-draft";
import type { SetComposerDraft } from "./use-board-navigation";
import type { ComposerMode, ComposerSubmission } from "./use-composer-submit";

interface Options {
  draft: ComposerDraft;
  onDraftChange: SetComposerDraft;
  today: string;
  /** What the current view adds to a new task. */
  context: QuickAddDefaults;
  projects: Project[];
  onSubmit: (submission: ComposerSubmission) => Promise<boolean>;
  /** A save failed and its text was not put back, because the field holds something newer. */
  onUnsaved: (drafts: QuickTask[]) => void;
}

/** The task being written: its text, the values picked with chips, and what happens when it is sent. */
export function useComposer({ draft, onDraftChange, today, context, projects, onSubmit, onUnsaved }: Options) {
  const [capturing, setCapturing] = useState(false);
  const { text, choice = NO_CHOICE } = draft;
  const [problem, setProblem] = useState<QuickAddProblem | null>(null);
  const [tagLimit, setTagLimit] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  // Whether the person changed the text since the field was last emptied for them: then the browser can undo it.
  const typed = useRef(false);
  const defaults = composerDefaults(context, choice);
  const values = composerValues(text, today, defaults, projects);
  const drafts = quickAddApi.previewDrafts(text, today, defaults, projects);
  const refusal = drafts || !text.trim() ? null : quickAddApi.problem(text, today, defaults, projects);
  // What more typing cannot fix is said while writing; a missing title only once the person tries to save.
  const standing = refusal && refusal.kind !== "title_missing" && refusal.kind !== "line_invalid" ? refusal : null;
  const disabled = !text.trim() || capturing;

  useEffect(() => { setProblem(null); setTagLimit(false); }, [text, choice]);

  const refocus = () => requestAnimationFrame(() => field.current?.focus({ preventScroll: true }));
  const onTextChange = (value: string) => onDraftChange((current) => ({ ...current, text: value }));
  const setChoice = (value: ComposerChoice) => onDraftChange((current) => ({ ...current, choice: value }));
  function change(value: string) {
    typed.current = true;
    onTextChange(value);
  }
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
    else setChoice({ ...next, tagInput: undefined });
  }
  function clear() {
    rewrite("");
    onDraftChange({ text: "" });
  }

  async function submit(mode: ComposerMode) {
    if (disabled) return;
    if (values.tags.length > MAX_DRAFT_TAGS) { setTagLimit(true); return; }
    if (mode === "ai") {
      setCapturing(true);
      // The button that started this is disabled meanwhile, so the keyboard waits in the field.
      refocus();
      try {
        if (await onSubmit({ mode, text: text.trim(), defaults }) && onDraftChange({ text: "" }, draft)) typed.current = false;
      }
      finally { setCapturing(false); refocus(); }
      return;
    }
    if (!drafts) {
      setProblem(refusal ?? { kind: "line_invalid", line: 1 });
      return;
    }
    // The field is free for the next task at once; a failed save brings this one back.
    const empty = { text: "" };
    if (!onDraftChange(empty, draft)) return;
    typed.current = false;
    refocus();
    if (await onSubmit({ mode, drafts })) return;
    if (!onDraftChange(draft, empty)) onUnsaved(drafts);
  }

  return {
    field, choice, values, drafts, disabled, capturing, problem: problem ?? standing, blocked: Boolean(standing), tagLimit,
    pristine: !text && choice === NO_CHOICE, hasOwnUndo: () => typed.current,
    change, rewrite, refocus, choose, addTag, clear, submit,
    setTagInput: (tagInput: string) => setChoice({ ...choice, tagInput }),
  };
}
