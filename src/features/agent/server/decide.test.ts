import { mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { taskSchema, type Task } from "@/features/tasks/schema";
import type { Project } from "@/features/projects/schema";
import { AgentError, proposedTaskSchema, type ProposalAction, type ProposalDraft } from "../schema";
import { createProposalRepository } from "./repository";
import { decideProposal, type ProposalOperations } from "./decide";

const source = { note: "Organize the day", today: "2026-11-17", provider: "anthropic", model: "test-model" } as const;
const task = taskSchema.parse({ id: "task", title: "Report", notes: "Preserve", priority: "low", done: false,
  createdAt: "2026-11-01T12:00:00Z", completedAt: null });
const project = { id: "00000000-0000-4000-8000-000000000001", name: "Acme" };
const creation = proposedTaskSchema.parse({ title: "Suggested task", due: null, repeat: null, plannedFor: "2026-11-17" });
let dir: string;
let repo: ReturnType<typeof createProposalRepository>;
let tasks: Task[];
let projects: Project[];
let operations: ProposalOperations;
async function pending(action: ProposalAction, taskBefore: Task | null = null, projectBefore: Project | null = null) {
  const draft: ProposalDraft = { action, taskBefore, projectBefore, reason: "The person's request" };
  return (await repo.addProposals([draft], source))[0];
}
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "tudu-test-proposals-")); repo = createProposalRepository(dir);
  tasks = [structuredClone(task)]; projects = [structuredClone(project)];
  operations = {
    listTasks: vi.fn(async () => tasks), listProjects: vi.fn(async () => projects),
    createTask: vi.fn(async (id, input) => {
      const created = taskSchema.parse({ ...input, id, done: false, completedAt: null, createdAt: "2026-11-17T12:00:00Z" });
      tasks.push(created); return created;
    }),
    updateTask: vi.fn(async (id, patch, expected) => {
      const current = tasks.find((task) => task.id === id);
      if (!current) return null;
      if (JSON.stringify(current) !== JSON.stringify(expected)) throw new AgentError("agent_stale");
      const changed = taskSchema.parse({ ...current, ...patch }); tasks = tasks.map((task) => task.id === id ? changed : task); return changed;
    }),
    createProject: vi.fn(async (id, name) => { const created = { id, name }; projects.push(created); return created; }),
    renameProject: vi.fn(async (id, name, expectedName) => {
      const current = projects.find((project) => project.id === id);
      if (!current) return null;
      if (current.name !== expectedName) throw new AgentError("agent_stale");
      const changed = { id, name }; projects = projects.map((project) => project.id === id ? changed : project); return changed;
    }),
  };
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("proposal approval and audit history", () => {
  it("stores only pending suggestions before approval and records the original plus edited accepted values", async () => {
    const proposal = await pending({ kind: "create_task", task: creation });
    expect(tasks).toEqual([task]); expect(projects).toEqual([project]);
    expect(await readdir(dir)).toEqual(["proposals.json"]);
    expect((await stat(path.join(dir, "proposals.json"))).mode & 0o777).toBe(0o600);
    const action = { kind: "create_task", task: { ...creation, title: "Human edit" } } as const;
    const accepted = await decideProposal(repo, proposal.id, { decision: "accept", action }, operations);
    expect(accepted).toMatchObject({ status: "accepted", action: proposal.action, approved: action, result: { kind: "task", task: { title: "Human edit", plannedFor: "2026-11-17" } } });
    expect(await createProposalRepository(dir).listProposals()).toEqual([accepted]);
    expect(tasks.map((task) => task.title)).toEqual(["Report", "Human edit"]);
    expect(await decideProposal(repo, proposal.id, { decision: "accept", action }, operations)).toEqual(accepted);
    expect(operations.createTask).toHaveBeenCalledOnce();
  });
  it("applies one decision across concurrent duplicate requests and refuses a conflicting rejection", async () => {
    const proposal = await pending({ kind: "create_task", task: creation });
    const decision = { decision: "accept", action: proposal.action } as const;
    const accepted = await Promise.all(Array.from({ length: 5 }, () => decideProposal(repo, proposal.id, decision, operations)));
    expect(new Set(accepted.map((proposal) => proposal.result?.kind === "task" && proposal.result.task.id)).size).toBe(1);
    expect(operations.createTask).toHaveBeenCalledOnce();
    await expect(decideProposal(repo, proposal.id, { decision: "reject" }, operations)).rejects.toMatchObject({ code: "agent_decided" });
  });
  it("rejects without touching tasks/projects, including duplicate rejection and later acceptance", async () => {
    const proposal = await pending({ kind: "create_project", name: "New client" });
    const rejected = await decideProposal(repo, proposal.id, { decision: "reject" }, operations);
    expect(rejected).toMatchObject({ status: "rejected", approved: null, result: null });
    expect(await decideProposal(repo, proposal.id, { decision: "reject" }, operations)).toEqual(rejected);
    await expect(decideProposal(repo, proposal.id, { decision: "accept", action: proposal.action }, operations)).rejects.toMatchObject({ code: "agent_decided" });
    expect(operations.createProject).not.toHaveBeenCalled(); expect(tasks).toEqual([task]); expect(projects).toEqual([project]);
  });
  it("applies a task patch and project rename while retaining their original snapshots", async () => {
    const change = await pending({ kind: "update_task", taskId: task.id, patch: { priority: "high", plannedFor: "2026-11-17" } }, task);
    await decideProposal(repo, change.id, { decision: "accept", action: change.action }, operations);
    expect(tasks[0]).toMatchObject({ title: task.title, notes: task.notes, priority: "high", plannedFor: "2026-11-17" });
    const rename = await pending({ kind: "rename_project", projectId: project.id, name: "Acme Q1" }, null, project);
    const result = await decideProposal(repo, rename.id, { decision: "accept", action: rename.action }, operations);
    expect(result.projectBefore).toEqual(project); expect(projects[0].name).toBe("Acme Q1");
  });
  it("refuses stale task/project changes and leaves them pending so they can be rejected", async () => {
    const change = await pending({ kind: "update_task", taskId: task.id, patch: { priority: "high" } }, task);
    tasks[0] = { ...tasks[0], notes: "A newer human edit" };
    await expect(decideProposal(repo, change.id, { decision: "accept", action: change.action }, operations)).rejects.toMatchObject({ code: "agent_stale" });
    expect((await repo.listProposals())[0]).toMatchObject({ status: "pending", approved: null });
    expect(tasks[0]).toMatchObject({ notes: "A newer human edit", priority: "low" });
    await decideProposal(repo, change.id, { decision: "reject" }, operations);
    const rename = await pending({ kind: "rename_project", projectId: project.id, name: "New name" }, null, project);
    projects[0] = { ...project, name: "Newer rename" };
    await expect(decideProposal(repo, rename.id, { decision: "accept", action: rename.action }, operations)).rejects.toMatchObject({ code: "agent_stale" });
    expect(projects[0].name).toBe("Newer rename");
  });
  it("prevents redirecting a proposal or expanding the fields it changes", async () => {
    const proposal = await pending({ kind: "update_task", taskId: task.id, patch: { priority: "high" } }, task);
    for (const action of [
      { kind: "update_task", taskId: "other", patch: { priority: "high" } },
      { kind: "update_task", taskId: task.id, patch: { priority: "high", notes: "Hidden change" } },
      { kind: "create_project", name: "Different action" },
    ] as const) await expect(decideProposal(repo, proposal.id, { decision: "accept", action }, operations)).rejects.toMatchObject({ code: "agent_invalid_proposal" });
    expect(operations.updateTask).not.toHaveBeenCalled();
  });
  it("does not write a task when recording approval fails and permits a later explicit retry", async () => {
    const proposal = await pending({ kind: "create_task", task: creation });
    const blocked = path.join(dir, `proposals.json.${process.pid}.tmp`); await mkdir(blocked);
    await expect(decideProposal(repo, proposal.id, { decision: "accept", action: proposal.action }, operations)).rejects.toThrow();
    expect(operations.createTask).not.toHaveBeenCalled();
    await rm(blocked, { recursive: true });
    await decideProposal(repo, proposal.id, { decision: "accept", action: proposal.action }, operations);
    expect(operations.createTask).toHaveBeenCalledOnce();
  });
  it("recovers a committed task after a failed audit write by reading, never applying twice", async () => {
    const proposal = await pending({ kind: "create_task", task: creation });
    const blocked = path.join(dir, `proposals.json.${process.pid}.tmp`);
    const create = operations.createTask;
    operations.createTask = vi.fn(async (id, input) => { const result = await create(id, input); await mkdir(blocked); return result; });
    await expect(decideProposal(repo, proposal.id, { decision: "accept", action: proposal.action }, operations)).rejects.toMatchObject({ code: "agent_uncertain" });
    expect((await repo.listProposals())[0].status).toBe("applying");
    await rm(blocked, { recursive: true });
    const recovered = await decideProposal(createProposalRepository(dir), proposal.id, { decision: "recheck" }, operations);
    expect(recovered.status).toBe("accepted"); expect(operations.createTask).toHaveBeenCalledOnce();
    expect(tasks).toHaveLength(2);
    expect(await decideProposal(repo, proposal.id, { decision: "recheck" }, operations)).toEqual(recovered);
  });
  it("keeps an uncertain write explicit, checks without replay and can dismiss it without claiming rejection or rollback", async () => {
    const proposal = await pending({ kind: "create_task", task: creation });
    vi.mocked(operations.createTask).mockRejectedValueOnce(new Error("private database failure"));
    await expect(decideProposal(repo, proposal.id, { decision: "accept", action: proposal.action }, operations)).rejects.toMatchObject({ code: "agent_uncertain" });
    await expect(decideProposal(repo, proposal.id, { decision: "recheck" }, operations)).rejects.toMatchObject({ code: "agent_uncertain" });
    expect(operations.createTask).toHaveBeenCalledOnce(); expect(tasks).toEqual([task]);
    const dismissed = await decideProposal(repo, proposal.id, { decision: "dismiss" }, operations);
    expect(dismissed).toMatchObject({ status: "unconfirmed", approved: proposal.action, result: null });
    expect(await decideProposal(repo, proposal.id, { decision: "dismiss" }, operations)).toEqual(dismissed);
  });
});
