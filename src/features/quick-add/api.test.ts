import { afterEach, describe, expect, it, vi } from "vitest";
import { tasksApi } from "@/features/tasks/api";
import { quickAddApi } from "./api";

const today = "2026-11-17";

describe("quick-add preview", () => {
  it("shows the normalized date, priority and tags of a valid draft", () => {
    expect(quickAddApi.preview("Corrigir login #BUG !high amanhã", today))
      .toMatchObject({ title: "Corrigir login", tags: ["bug"], priority: "high", due: "2026-11-18" });
  });

  it("leaves escaped and missing shortcuts out of the preview", () => {
    const preview = quickAddApi.preview(String.raw`Discuss \#bug \today`, today);
    expect(preview).toMatchObject({ tags: [], due: null });
    expect(preview).not.toHaveProperty("priority");
  });

  it("waits for valid input and a known local day", () => {
    expect(quickAddApi.preview(" ", today)).toBeNull();
    expect(quickAddApi.preview("#bug tomorrow", today)).toBeNull();
    expect(quickAddApi.preview("Report tomorrow", "")).toBeNull();
  });
});

describe("quick-add in the active list", () => {
  afterEach(() => vi.restoreAllMocks());

  it("preserves an explicit due date when a task is added to Today", async () => {
    const create = vi.spyOn(tasksApi, "create").mockResolvedValue([]);
    await quickAddApi.create("Draft notes tomorrow", today, { plannedFor: today });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ title: "Draft notes", due: "2026-11-18", plannedFor: today }));
  });

  it("assigns the active project and leaves the default priority to the server", async () => {
    const create = vi.spyOn(tasksApi, "create").mockResolvedValue([]);
    const projectId = "00000000-0000-4000-8000-000000000001";
    await quickAddApi.create("Draft notes", today, { projectId });
    const [input] = create.mock.calls[0];
    expect(input).toMatchObject({ projectId, title: "Draft notes", tags: [] });
    expect(input).not.toHaveProperty("priority");
  });

  it("combines typed tags with the active tag, counting each tag once", async () => {
    const create = vi.spyOn(tasksApi, "create").mockResolvedValue([]);
    await quickAddApi.create("Draft notes #work", today, { tag: "writing" });
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ["work", "writing"] }));
    await quickAddApi.create("Draft notes #WORK #client", today, { tag: "work" });
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ["work", "client"] }));
  });

  it("rejects an eleventh distinct tag before saving", async () => {
    const create = vi.spyOn(tasksApi, "create").mockResolvedValue([]);
    const tags = Array.from({ length: 10 }, (_, i) => `#tag${i}`).join(" ");
    await expect(quickAddApi.create(`Draft notes ${tags}`, today, { tag: "writing" }))
      .rejects.toMatchObject({ code: "invalid_quick_task" });
    expect(create).not.toHaveBeenCalled();
    await quickAddApi.create(`Draft notes ${tags}`, today, { tag: "tag0" });
    expect(create).toHaveBeenCalledOnce();
  });
});

describe("controlled quick-add details", () => {
  it("applies common defaults to each line and lets recognized text override them", () => {
    const project = { id: "00000000-0000-4000-8000-000000000002", name: "Acme Web" };
    const defaults = { priority: "low", due: today, tags: ["team"], tag: "work",
      projectId: "00000000-0000-4000-8000-000000000001" } as const;
    expect(quickAddApi.previewDrafts("First !high tomorrow @acme-web ~30m #bug\n\nSecond @unknown", today, {
      ...defaults, tags: [...defaults.tags], plannedFor: today,
    }, [project])).toMatchObject([
      { title: "First", priority: "high", due: "2026-11-18", estimateHours: 0.5, projectId: project.id, tags: ["bug", "team", "work"], plannedFor: today },
      { title: "Second @unknown", priority: "low", due: today, projectId: defaults.projectId, tags: ["team", "work"], plannedFor: today },
    ]);
  });

  it("removes only the shortcuts that correspond to the control being edited", () => {
    expect(quickAddApi.stripTokens(String.raw`!high Draft \!low #work`, "priority").trim()).toBe(String.raw`Draft \!low #work`);
    expect(quickAddApi.stripTokens(String.raw`tomorrow Draft \tomorrow #work`, "due").trim()).toBe(String.raw`Draft \tomorrow #work`);
    expect(quickAddApi.stripTokens(String.raw`#work Draft \#work #docs`, "tag", "work").trim()).toBe(String.raw`Draft \#work #docs`);
  });
});
