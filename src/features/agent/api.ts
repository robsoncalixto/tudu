import { z } from "zod";
import { request } from "@/lib/http";
import { agentStateSchema, proposalSchema, taskReviewResponseSchema, type ProposalDecision } from "./schema";

export const agentApi = {
  get: () => request<unknown>("/api/agent/proposals").then((data) => agentStateSchema.parse(data)),
  propose: (text: string, today: string) => request<unknown>("/api/agent/proposals", { method: "POST", body: { text, today } })
    .then((data) => z.object({ proposals: z.array(proposalSchema) }).parse(data).proposals).then(updated),
  review: (text: string, today: string) => request<unknown>("/api/agent/proposals", { method: "POST", body: { text, today, review: true } })
    .then((data) => taskReviewResponseSchema.parse(data)).then(updated),
  async decide(id: string, decision: ProposalDecision) {
    const response = await request<unknown>(`/api/agent/proposals/${encodeURIComponent(id)}`, { method: "POST", body: decision });
    const { proposal } = z.object({ proposal: proposalSchema }).parse(response);
    return updated(proposal);
  },
};

const changeEvent = "tudu:agent-updated";

export function subscribeAgentUpdates(callback: () => void) {
  window.addEventListener(changeEvent, callback);
  return () => window.removeEventListener(changeEvent, callback);
}

export function watchAgent(callback: () => void) {
  function refresh() { if (document.visibilityState === "visible") callback(); }
  const timer = window.setInterval(refresh, 10_000);
  const stop = subscribeAgentUpdates(refresh);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
  return () => {
    window.clearInterval(timer);
    stop();
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", refresh);
  };
}

function updated<T>(value: T): T {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(changeEvent));
  return value;
}
