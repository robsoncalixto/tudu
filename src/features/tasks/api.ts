import { request } from "@/lib/http";
import { taskUpdateSchema, type Task, type TaskPatch } from "./schema";

export const tasksApi = {
  list: () => request<{ tasks: Task[] }>("/api/tasks").then((data) => data.tasks),
  create: (title: string) =>
    request<{ tasks: Task[] }>("/api/tasks", { method: "POST", body: { title } }).then((data) => data.tasks),
  update: (id: string, patch: TaskPatch) =>
    request<unknown>(`/api/tasks/${id}`, { method: "PATCH", body: patch }).then((data) => taskUpdateSchema.parse(data)),
  remove: (id: string) => request<void>(`/api/tasks/${id}`, { method: "DELETE" }),
};
