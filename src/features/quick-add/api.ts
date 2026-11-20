import type { Project } from "@/features/projects/schema";
import { tasksApi } from "@/features/tasks/api";
import { ApiError } from "@/lib/http";
import { completionAt, isTyped, quickSuggestions } from "./completion";
import {
  QuickDraftError, parseQuickAdd, parseQuickEdit, parseQuickTask, quickTaskDrafts, quickTextTokens, quickTextWarnings, settledWarnings,
  stripQuickTokens, titleWords,
} from "./parser";
import type { QuickAddDefaults, QuickAddProblem, QuickCompletion, QuickSuggestion, QuickTask, QuickTokenType, SuggestionSources } from "./schema";

export const quickAddApi = {
  preview(text: string, today: string, projects: readonly Project[] = []): QuickTask | null {
    try { return parseQuickTask(text, today, projects); } catch { return null; }
  },
  previewDrafts(text: string, today: string, defaults: QuickAddDefaults, projects: readonly Project[] = []): QuickTask[] | null {
    try { return quickTaskDrafts(text, today, defaults, projects); } catch { return null; }
  },
  problem(text: string, today: string, defaults: QuickAddDefaults, projects: readonly Project[]): QuickAddProblem | null {
    try { quickTaskDrafts(text, today, defaults, projects); return null; }
    catch (error) { return error instanceof QuickDraftError ? error.problem : null; }
  },
  /** One line as typed: what was recognized, where, and what could not be read. */
  parse: (text: string, today: string, projects: readonly Project[] = []) => parseQuickAdd(text, { today, projects }),
  /** `editing` is the saved title being edited, whose words are never read as tokens. */
  tokens: (text: string, today: string, projects: readonly Project[] = [], editing?: string) =>
    quickTextTokens(text, { today, projects, ...(editing === undefined ? {} : { literals: titleWords(editing) }) }),
  /** With a `caret`, the word being typed there is not reported yet. */
  warnings: (text: string, today: string, projects: readonly Project[] = [], at: { caret?: number | null; editing?: string } = {}) => settledWarnings(
    quickTextWarnings(text, { today, projects, ...(at.editing === undefined ? {} : { literals: titleWords(at.editing) }) }), at.caret ?? null),
  stripTokens: (text: string, today: string, projects: readonly Project[], type: QuickTokenType, value?: string) =>
    stripQuickTokens(text, { today, projects }, type, value),
  edit: (original: string, edited: string, today: string, projects: readonly Project[] = []) =>
    parseQuickEdit(original, edited, { today, projects }),
  /** The token being typed at the caret, what could complete it, and whether it is already complete. */
  completion: completionAt,
  suggestions: (completion: QuickCompletion, sources: SuggestionSources, used: readonly string[] = []) => quickSuggestions(completion, sources, used),
  isTyped: (word: string, suggestion: QuickSuggestion, sources: SuggestionSources) => isTyped(word, suggestion, sources),
  async create(text: string, today: string, context: QuickAddDefaults = {}, projects: readonly Project[] = []) {
    const drafts = quickAddApi.previewDrafts(text, today, context, projects);
    if (!drafts) throw new ApiError("invalid_quick_task", 400);
    return tasksApi.create(drafts.length === 1 ? drafts[0] : drafts);
  },
};
