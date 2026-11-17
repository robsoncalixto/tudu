import { request } from "@/lib/http";
import type { Task, TaskPatch } from "./schema";

export const tasksApi = {
  list: () => request<{ tasks: Task[] }>("/api/tasks").then((data) => data.tasks),
  create: (title: string) =>
    request<{ tasks: Task[] }>("/api/tasks", { method: "POST", body: { title } }).then((data) => data.tasks),
  update: (id: string, patch: TaskPatch) =>
    request<{ task: Task }>(`/api/tasks/${id}`, { method: "PATCH", body: patch }).then((data) => data.task),
  remove: (id: string) => request<void>(`/api/tasks/${id}`, { method: "DELETE" }),
};
