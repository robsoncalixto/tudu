import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { createReviewState } from "./review-state";

it.each(["{invalid", '{"status":"unknown"}'])("preserves and recovers invalid review status %s", async (content) => {
  const directory = await mkdtemp(path.join(tmpdir(), "tudu-test-review-state-"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const state = createReviewState(directory);
    const file = path.join(directory, "agent-review.json");
    const ranAt = "2026-11-17T12:00:00.000Z";
    await writeFile(file, content, { mode: 0o600 });
    await expect(state.read()).rejects.toThrow();
    expect(await readFile(file, "utf8")).toBe(content);
    const recovered = { fingerprint: null, status: { ranAt, outcome: "failed" } };
    expect(await state.read(ranAt)).toEqual(recovered);
    expect(await state.read()).toEqual(recovered);
    const preserved = (await readdir(directory)).find((name) => name.startsWith("agent-review.json.corrupt-"));
    expect(preserved).toBeDefined();
    expect(await readFile(path.join(directory, preserved!), "utf8")).toBe(content);
    expect(log).toHaveBeenCalledTimes(1);
  } finally {
    log.mockRestore();
    await rm(directory, { recursive: true, force: true });
  }
});
