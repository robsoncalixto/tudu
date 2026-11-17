import { z } from "zod";
import { request } from "@/lib/http";
import { agentStateSchema, proposalSchema, type ProposalDecision } from "./schema";

export const agentApi = {
  get: () => request<unknown>("/api/agent/proposals").then((data) => agentStateSchema.parse(data)),
  propose: (text: string, today: string) => request<unknown>("/api/agent/proposals", { method: "POST", body: { text, today } })
    .then((data) => z.object({ proposals: z.array(proposalSchema) }).parse(data).proposals),
  decide: (id: string, decision: ProposalDecision) => request<unknown>(`/api/agent/proposals/${encodeURIComponent(id)}`, { method: "POST", body: decision })
    .then((data) => z.object({ proposal: proposalSchema }).parse(data).proposal),
};
