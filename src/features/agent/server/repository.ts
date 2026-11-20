import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { withoutPendingDuplicates } from "../review";
import { AgentError, proposalSchema, proposalSourceSchema, type Proposal, type ProposalDraft, type ProposalSource } from "../schema";

const state = globalThis as typeof globalThis & { __tuduProposalQueues?: Map<string, Promise<unknown>> };
export function createProposalRepository(dataDir: string) {
  const file = path.join(dataDir, "proposals.json");
  function locked<T>(operation: () => Promise<T>): Promise<T> {
    state.__tuduProposalQueues ??= new Map();
    const run = (state.__tuduProposalQueues.get(file) ?? Promise.resolve()).then(operation, operation);
    state.__tuduProposalQueues.set(file, run.catch(() => undefined));
    return run;
  }
  async function read(): Promise<Proposal[]> {
    try { return z.array(proposalSchema).parse(JSON.parse(await fs.readFile(file, "utf8"))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  }
  async function write(proposals: Proposal[]) {
    await fs.mkdir(dataDir, { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(proposals, null, 2), { mode: 0o600 });
    await fs.rename(temporary, file);
  }
  return {
    listProposals: () => locked(read),
    addProposals: (drafts: ProposalDraft[], source: ProposalSource) => locked(async () => {
      const parsedSource = proposalSourceSchema.parse(source);
      const previous = drafts.length ? await read() : [];
      const remaining = parsedSource.review ? withoutPendingDuplicates(drafts, previous) : drafts;
      const created = remaining.map((draft) => proposalSchema.parse({
        ...draft, id: randomUUID(), createdAt: new Date().toISOString(), source: parsedSource,
        status: "pending", approved: null, result: null, decidedAt: null, appliedAt: null,
      }));
      if (created.length) await write([...previous, ...created]);
      return created;
    }),
    change: <T>(id: string, operation: (proposal: Proposal, save: (next: Proposal) => Promise<Proposal>) => Promise<T>): Promise<T> => locked(async () => {
      let proposals = await read();
      const current = proposals.find((proposal) => proposal.id === id);
      if (!current) throw new AgentError("not_found");
      return operation(current, async (next) => {
        const parsed = proposalSchema.parse(next);
        if (parsed.id !== id) throw new AgentError("agent_invalid_proposal");
        const updated = proposals.map((proposal) => proposal.id === id ? parsed : proposal);
        await write(updated);
        proposals = updated;
        return parsed;
      });
    }),
  };
}
export type ProposalRepository = ReturnType<typeof createProposalRepository>;
export const proposalRepository = createProposalRepository(process.env.DATA_DIR ?? path.join(process.cwd(), "data"));
