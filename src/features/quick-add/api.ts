import { tasksApi } from "@/features/tasks/api";
import { ApiError } from "@/lib/http";
import { parseQuickTask } from "./parser";
import type { QuickTask } from "./schema";

export const quickAddApi = {
  async create(text: string, today: string) {
    let input: QuickTask;
    try { input = parseQuickTask(text, today); }
    catch { throw new ApiError("invalid_quick_task", 400); }
    return tasksApi.create(input);
  },
};
