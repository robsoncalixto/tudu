import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createProposalRepository } from "./repository";

let dir: string;
const source = { note: "Organize", today: "2026-11-17", provider: "openai", model: "test" } as const;
const draft = { action: { kind: "create_project", name: "New client" }, reason: "Requested", taskBefore: null, projectBefore: null } as const;
beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), "tudu-test-proposal-journal-")); });
afterEach(() => rm(dir, { recursive: true, force: true }));

it("does not create a journal for reads or empty suggestions", async () => {
  const repository = createProposalRepository(dir);
  expect(await repository.listProposals()).toEqual([]);
  expect(await repository.addProposals([], source)).toEqual([]);
  expect(await readdir(dir)).toEqual([]);
});
it.each(['{broken', '[{"status":"accepted"}]'])("preserves invalid history instead of silently overwriting %s", async (content) => {
  const file = path.join(dir, "proposals.json"); await writeFile(file, content);
  const repository = createProposalRepository(dir);
  await expect(repository.listProposals()).rejects.toThrow();
  await expect(repository.addProposals([draft], source)).rejects.toThrow();
  expect(await readFile(file, "utf8")).toBe(content);
});
it("shares a queue across repository instances without losing concurrent proposals", async () => {
  await Promise.all(Array.from({ length: 8 }, () => createProposalRepository(dir).addProposals([draft], source)));
  const proposals = await createProposalRepository(dir).listProposals();
  expect(proposals).toHaveLength(8); expect(new Set(proposals.map((proposal) => proposal.id)).size).toBe(8);
  expect(proposals.every((proposal) => proposal.status === "pending" && proposal.approved === null)).toBe(true);
});
