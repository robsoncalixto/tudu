import { request } from "@/lib/http";
import type { Project } from "./schema";

export const projectsApi = {
  list: () => request<{ projects: Project[] }>("/api/projects").then((data) => data.projects),
  create: (name: string) => request<{ project: Project }>("/api/projects", {
    method: "POST", body: { name },
  }).then((data) => data.project),
  rename: (id: string, name: string) => request<{ project: Project }>(`/api/projects/${id}`, {
    method: "PATCH", body: { name },
  }).then((data) => data.project),
  remove: (id: string) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),
};
