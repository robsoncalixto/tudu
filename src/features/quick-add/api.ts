import type { Project } from "@/features/projects/schema";
import { tasksApi } from "@/features/tasks/api";
import { ApiError } from "@/lib/http";
import { QuickDraftError, parseQuickTask, quickTaskDrafts, stripQuickTokens } from "./parser";
import type { QuickAddDefaults, QuickAddProblem, QuickTask } from "./schema";

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
  stripTokens: stripQuickTokens,
  async create(text: string, today: string, context: QuickAddDefaults = {}, projects: readonly Project[] = []) {
    const drafts = quickAddApi.previewDrafts(text, today, context, projects);
    if (!drafts) throw new ApiError("invalid_quick_task", 400);
    return tasksApi.create(drafts.length === 1 ? drafts[0] : drafts);
  },
};
