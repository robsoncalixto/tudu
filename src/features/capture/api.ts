import { taskListSchema } from "@/features/tasks/schema";
import { request } from "@/lib/http";

import type { CaptureDefaults } from "./schema";

export const captureApi = {
  status: () => request<{ enabled: boolean }>("/api/ai/capture").then((data) => data.enabled),
  capture: (text: string, today: string, defaults?: CaptureDefaults) =>
    request<unknown>("/api/ai/capture", { method: "POST", body: { text, today, ...(defaults && Object.keys(defaults).length ? { defaults } : {}) } }).then(
      (data) => taskListSchema.parse(data).tasks,
    ),
};
