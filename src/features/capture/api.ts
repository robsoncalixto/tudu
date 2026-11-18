import { taskListSchema } from "@/features/tasks/schema";
import { request } from "@/lib/http";

export const captureApi = {
  status: () => request<{ enabled: boolean }>("/api/ai/capture").then((data) => data.enabled),
  capture: (text: string, today: string) =>
    request<unknown>("/api/ai/capture", { method: "POST", body: { text, today } }).then(
      (data) => taskListSchema.parse(data).tasks,
    ),
};
