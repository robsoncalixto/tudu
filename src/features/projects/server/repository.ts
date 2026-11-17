import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { projectInputSchema, projectNameKey, projectSchema, type Project, type ProjectInput } from "../schema";

const state = globalThis as typeof globalThis & { __tuduProjectQueues?: Map<string, Promise<unknown>> };

export class ProjectError extends Error {
  constructor(public readonly code: "duplicate_project" | "invalid_project") { super(code); }
}
export class ProjectChangedError extends Error {}

export function createProjectRepository(dataDir: string) {
  const file = path.join(dataDir, "projects.json");
  function locked<T>(operation: () => Promise<T>): Promise<T> {
    state.__tuduProjectQueues ??= new Map();
    const run = (state.__tuduProjectQueues.get(file) ?? Promise.resolve()).then(operation, operation);
    state.__tuduProjectQueues.set(file, run.catch(() => undefined));
    return run;
  }
  async function read(): Promise<Project[]> {
    try {
      return z.array(projectSchema).parse(JSON.parse(await fs.readFile(file, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  async function write(projects: Project[]) {
    await fs.mkdir(dataDir, { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(projects, null, 2), "utf8");
    await fs.rename(temporary, file);
  }
  function unique(projects: Project[], name: string, except?: string) {
    if (projects.some((project) => project.id !== except && projectNameKey(project.name) === projectNameKey(name))) {
      throw new ProjectError("duplicate_project");
    }
  }
  return {
    listProjects: () => locked(read),
    addProject: (input: ProjectInput, id: string = randomUUID()) => locked(async () => {
      const projects = await read();
      const parsed = projectInputSchema.parse(input);
      const existing = projects.find((project) => project.id === id);
      if (existing) return existing;
      unique(projects, parsed.name);
      const project = projectSchema.parse({ id, ...parsed });
      await write([...projects, project]);
      return project;
    }),
    updateProject: (id: string, input: ProjectInput, expectedName?: string) => locked(async () => {
      const projects = await read();
      const current = projects.find((project) => project.id === id);
      if (!current) return null;
      if (expectedName !== undefined && current.name !== expectedName) throw new ProjectChangedError();
      const parsed = projectInputSchema.parse(input);
      unique(projects, parsed.name, id);
      const updated = { id, ...parsed };
      await write(projects.map((project) => project.id === id ? updated : project));
      return updated;
    }),
    deleteProject: (id: string, clearAssignments: (id: string) => Promise<void>) => locked(async () => {
      const projects = await read();
      if (!projects.some((project) => project.id === id)) return false;
      await clearAssignments(id);
      await write(projects.filter((project) => project.id !== id));
      return true;
    }),
    // Hold the same lock as deletion until the task mutation is saved.
    withValidProjectIds: <T>(ids: (string | null | undefined)[], operation: () => Promise<T>): Promise<T> => locked(async () => {
      const projects = await read();
      if (ids.some((id) => id && !projects.some((project) => project.id === id))) {
        throw new ProjectError("invalid_project");
      }
      return operation();
    }),
  };
}

export const { listProjects, addProject, updateProject, deleteProject, withValidProjectIds } = createProjectRepository(
  process.env.DATA_DIR ?? path.join(process.cwd(), "data"),
);
