import { beforeEach, describe, expect, it, vi } from "vitest";
const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { parse }; } }));
import { captureTasks } from "./capture";

beforeEach(() => vi.clearAllMocks());

describe("AI checklist capture", () => {
  it("returns trimmed steps with unique ids and skips blank steps", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { tasks: [{
      title: "Prepare release", notes: "", priority: "medium", due: null, tags: [],
      steps: ["  Run tests  ", " ", "Publish", "Run tests"],
    }] } });
    const [task] = await captureTasks("Release: run tests, then publish", "2026-11-17");
    expect(task.steps.map((step) => step.title)).toEqual(["Run tests", "Publish", "Run tests"]);
    expect(task.steps.every((step) => !step.done)).toBe(true);
    expect(new Set(task.steps.map((step) => step.id)).size).toBe(3);
    expect(parse).toHaveBeenCalledOnce();
  });

  it("keeps tasks without steps usable and bounds the returned checklist", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { tasks: [
      { title: "Simple", notes: "", priority: "medium", due: null, tags: [], steps: [] },
      { title: "Large", notes: "", priority: "medium", due: null, tags: [], steps: Array(105).fill("x".repeat(400)) },
    ] } });
    const tasks = await captureTasks("Note", "2026-11-17");
    expect(tasks[0].steps).toEqual([]);
    expect(tasks[1].steps).toHaveLength(100);
    expect(tasks[1].steps[0].title).toHaveLength(300);
  });
  it("selects only known projects and includes their names in the model context", async () => {
    const project = { id: "00000000-0000-4000-8000-000000000001", name: "Acme" };
    const draft = { title: "Report", notes: "", priority: "medium", due: null, tags: [], steps: [] };
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { tasks: [
      { ...draft, projectId: project.id }, { ...draft, projectId: "invented-id" }, { ...draft, projectId: null },
    ] } });
    const tasks = await captureTasks("Acme report", "2026-11-17", [project]);
    expect(tasks.map((task) => task.projectId)).toEqual([project.id, null, null]);
    expect(parse.mock.calls[0][0].messages[0].content).toContain(JSON.stringify([project]));
  });
});
