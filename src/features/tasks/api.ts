import { request } from "@/lib/http";
import { taskListSchema, taskUpdateSchema, type TaskDraft, type TaskPatch } from "./schema";

export const tasksApi = {
  list: () => request<unknown>("/api/tasks").then((data) => taskListSchema.parse(data).tasks),
  create: (input: TaskDraft | string) =>
    request<unknown>("/api/tasks", { method: "POST", body: typeof input === "string" ? { title: input } : input })
      .then((data) => taskListSchema.parse(data).tasks),
  update: (id: string, patch: TaskPatch) =>
    request<unknown>(`/api/tasks/${id}`, { method: "PATCH", body: patch }).then((data) => taskUpdateSchema.parse(data)),
  remove: (id: string) => request<void>(`/api/tasks/${id}`, { method: "DELETE" }),
};
