import { afterEach, describe, expect, it, vi } from "vitest";
import { tasksApi } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("loading the task list", () => {
  it("accepts an empty result and rejects missing or invalid tasks", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ tasks: [] }))
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(Response.json({ tasks: [{ id: "unfinished" }] }));
    vi.stubGlobal("fetch", fetch);

    await expect(tasksApi.list()).resolves.toEqual([]);
    await expect(tasksApi.list()).rejects.toThrow();
    await expect(tasksApi.list()).rejects.toThrow();
  });
});

it("normalizes saved task fields returned after creation", async () => {
  const saved = { id: "1", title: "Draft notes", createdAt: "2026-11-17T15:00:00Z", completedAt: null, done: false };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ tasks: [saved] })));
  await expect(tasksApi.create(saved.title)).resolves.toMatchObject([
    { ...saved, steps: [], tags: [], repeat: null, plannedFor: null, projectId: null },
  ]);
});
