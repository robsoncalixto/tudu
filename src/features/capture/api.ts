import type { Task } from "@/features/tasks/schema";
import { request } from "@/lib/http";

export const captureApi = {
  status: () => request<{ enabled: boolean }>("/api/ai/capture").then((data) => data.enabled),
  capture: (text: string, today: string) =>
    request<{ tasks: Task[] }>("/api/ai/capture", { method: "POST", body: { text, today } }).then(
      (data) => data.tasks,
    ),
};
