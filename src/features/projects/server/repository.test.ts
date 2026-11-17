import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProjectRepository } from "./repository";

let dir: string;
let repo: ReturnType<typeof createProjectRepository>;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "tudu-test-projects-"));
  repo = createProjectRepository(dir);
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("project registry", () => {
  it("persists creation and rename with stable ids and atomic writes", async () => {
    expect(await repo.listProjects()).toEqual([]);
    const project = await repo.addProject({ name: "  Acme  " });
    expect(project.name).toBe("Acme");
    expect(await repo.updateProject(project.id, { name: "Acme Q1" })).toEqual({ ...project, name: "Acme Q1" });
    expect(await createProjectRepository(dir).listProjects()).toEqual([{ ...project, name: "Acme Q1" }]);
    expect(await readdir(dir)).toEqual(["projects.json"]);
  });
  it("rejects duplicate names during create and rename, allowing a case-only rename", async () => {
    const first = await repo.addProject({ name: "Acme" });
    await expect(repo.addProject({ name: " acme " })).rejects.toMatchObject({ code: "duplicate_project" });
    const second = await repo.addProject({ name: "Other" });
    await expect(repo.updateProject(second.id, { name: "ACME" })).rejects.toMatchObject({ code: "duplicate_project" });
    expect(await repo.updateProject(first.id, { name: "ACME" })).toMatchObject({ id: first.id, name: "ACME" });
  });
  it("clears assignments when deleting and leaves the registry unchanged if clearing fails", async () => {
    const project = await repo.addProject({ name: "Acme" });
    const clear = vi.fn().mockRejectedValueOnce(new Error("store unavailable")).mockResolvedValue(undefined);
    await expect(repo.deleteProject(project.id, clear)).rejects.toThrow("store unavailable");
    expect(await repo.listProjects()).toEqual([project]);
    expect(await repo.deleteProject(project.id, clear)).toBe(true);
    expect(clear).toHaveBeenLastCalledWith(project.id);
    expect(await repo.listProjects()).toEqual([]);
    expect(await repo.deleteProject(project.id, clear)).toBe(false);
    expect(await repo.updateProject("missing", { name: "x" })).toBeNull();
  });
  it("serializes concurrent writes without losing projects or accepting duplicate names", async () => {
    await Promise.all(Array.from({ length: 12 }, (_, i) => repo.addProject({ name: `Client ${i}` })));
    expect(await repo.listProjects()).toHaveLength(12);
    const results = await Promise.allSettled([repo.addProject({ name: "Same" }), repo.addProject({ name: "same" })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  });
  it("does not assign a project while its deletion is waiting to clear tasks", async () => {
    const project = await repo.addProject({ name: "Acme" });
    let release!: () => void;
    let started!: () => void;
    const start = new Promise<void>((resolve) => { started = resolve; });
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const deletion = repo.deleteProject(project.id, async () => { started(); await hold; });
    await start;
    const mutate = vi.fn(async () => true);
    const assignment = repo.withValidProjectIds([project.id], mutate);
    const result = Promise.allSettled([deletion, assignment]);
    expect(mutate).not.toHaveBeenCalled();
    release();
    expect((await result).map((item) => item.status)).toEqual(["fulfilled", "rejected"]);
    expect(mutate).not.toHaveBeenCalled();
  });
  it("holds assignment mutations until saved before allowing deletion", async () => {
    const project = await repo.addProject({ name: "Acme" });
    const events: string[] = [];
    let release!: () => void;
    let started!: () => void;
    const start = new Promise<void>((resolve) => { started = resolve; });
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const assignment = repo.withValidProjectIds([project.id], async () => {
      started(); await hold; events.push("assigned");
    });
    await start;
    const deletion = repo.deleteProject(project.id, async () => { events.push("cleared"); });
    expect(events).toEqual([]);
    release();
    await Promise.all([assignment, deletion]);
    expect(events).toEqual(["assigned", "cleared"]);
    const mutate = vi.fn(async () => true);
    await expect(repo.withValidProjectIds([project.id], mutate)).rejects.toMatchObject({ code: "invalid_project" });
    expect(mutate).not.toHaveBeenCalled();
    expect(await repo.withValidProjectIds([null, undefined], mutate)).toBe(true);
  });
});
