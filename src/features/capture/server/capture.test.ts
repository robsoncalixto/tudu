import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateStructured } from "@/features/ai/schema";
const generate = vi.fn<GenerateStructured>();
const run = generate as GenerateStructured;
import { captureTasks } from "./capture";

beforeEach(() => vi.clearAllMocks());

describe("AI checklist capture", () => {
  it("drops impossible model dates rather than saving invalid calendar days", async () => {
    generate.mockResolvedValue({ tasks: [{ title: "Report", notes: "", priority: "medium", due: "2026-02-30", tags: [], steps: [], projectId: null }] });
    expect((await captureTasks(run, "Report", "2026-11-17"))[0].due).toBeNull();
  });
  it("returns trimmed steps with unique ids and skips blank steps", async () => {
    generate.mockResolvedValue({ tasks: [{
      title: "Prepare release", notes: "", priority: "medium", due: null, tags: [],
      projectId: null, steps: ["  Run tests  ", " ", "Publish", "Run tests"],
    }] });
    const [task] = await captureTasks(run, "Release: run tests, then publish", "2026-11-17");
    expect(task.steps.map((step) => step.title)).toEqual(["Run tests", "Publish", "Run tests"]);
    expect(task.steps.every((step) => !step.done)).toBe(true);
    expect(new Set(task.steps.map((step) => step.id)).size).toBe(3);
    expect(generate).toHaveBeenCalledOnce();
  });

  it("keeps tasks without steps usable and bounds the returned checklist", async () => {
    generate.mockResolvedValue({ tasks: [
      { title: "Simple", notes: "", priority: "medium", due: null, tags: [], steps: [], projectId: null },
      { title: "Large", notes: "", priority: "medium", due: null, tags: [], projectId: null, steps: Array(105).fill("x".repeat(400)) },
    ] });
    const tasks = await captureTasks(run, "Note", "2026-11-17");
    expect(tasks[0].steps).toEqual([]);
    expect(tasks[1].steps).toHaveLength(100);
    expect(tasks[1].steps[0].title).toHaveLength(300);
  });
  it("selects only known projects and includes their names in the model context", async () => {
    const project = { id: "00000000-0000-4000-8000-000000000001", name: "Acme" };
    const draft = { title: "Report", notes: "", priority: "medium", due: null, tags: [], steps: [] };
    generate.mockResolvedValue({ tasks: [
      { ...draft, projectId: project.id }, { ...draft, projectId: "invented-id" }, { ...draft, projectId: null },
    ] });
    const tasks = await captureTasks(run, "Acme report", "2026-11-17", [project]);
    expect(tasks.map((task) => task.projectId)).toEqual([project.id, null, null]);
    expect(generate.mock.calls[0][0].input).toContain(JSON.stringify([project]));
  });
  it("uses the configured default priority in capture instructions", async () => {
    generate.mockResolvedValue({ tasks: [{
      title: "Report", notes: "", priority: "low", due: null, tags: [], steps: [], projectId: null,
    }] });
    const [task] = await captureTasks(run, "Write report", "2026-11-17", [], "low");
    expect(generate.mock.calls[0][0].system).toContain('otherwise "low"');
    expect(task.priority).toBe("low");
  });
});

it("applies composer defaults to generated drafts without replacing a date stated in the note", async () => {
  const draft = { title: "Review", notes: "", priority: "low", due: null, tags: ["review"], steps: [], projectId: null };
  generate.mockResolvedValue({ tasks: [draft, { ...draft, title: "Ship", due: "2026-11-20" }] });
  const tasks = await captureTasks(run, "Review and ship Friday", "2026-11-17", [], "low", {
    tags: ["work", "review"], plannedFor: "2026-11-17", due: "2026-11-18",
  });
  expect(tasks).toMatchObject([
    { title: "Review", due: "2026-11-18", tags: ["work", "review"], plannedFor: "2026-11-17" },
    { title: "Ship", due: "2026-11-20", tags: ["work", "review"], plannedFor: "2026-11-17" },
  ]);
});

it("does not assign a capture default to a project that no longer exists", async () => {
  generate.mockResolvedValue({ tasks: [{ title: "Review", notes: "", priority: "medium", due: null, tags: [], steps: [], projectId: null }] });
  const tasks = await captureTasks(run, "Review", "2026-11-17", [], "medium", {
    projectId: "00000000-0000-4000-8000-000000000001",
  });
  expect(tasks[0].projectId).toBeNull();
});
