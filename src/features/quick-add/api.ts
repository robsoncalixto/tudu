import { tasksApi } from "@/features/tasks/api";
import { ApiError } from "@/lib/http";
import { parseQuickTask } from "./parser";
import { quickTaskSchema, type QuickTask } from "./schema";

export const quickAddApi = {
  preview(text: string, today: string): QuickTask | null {
    if (!text.trim() || !today) return null;
    try {
      return parseQuickTask(text, today);
    } catch {
      return null;
    }
  },
  async create(text: string, today: string, context: { projectId?: string; tag?: string; plannedFor?: string } = {}) {
    const input = quickAddApi.preview(text, today);
    if (!input) throw new ApiError("invalid_quick_task", 400);
    const { tag, ...defaults } = context;
    const tags = tag ? [...new Set([...input.tags, tag])] : input.tags;
    const contextual = quickTaskSchema.safeParse({ ...input, ...defaults, tags });
    if (!contextual.success) throw new ApiError("invalid_quick_task", 400);
    return tasksApi.create(contextual.data);
  },
};
