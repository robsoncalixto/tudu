import { AiError } from "@/features/ai/schema";
import { AgentError } from "@/features/agent/schema";

export function agentFailure(error: unknown): Response {
  const code = error instanceof AgentError ? error.code : error instanceof AiError
    ? error.code === "ai_refused" || error.code === "ai_failed" ? "agent_failed" : error.code : "agent_failed";
  const status = code === "not_found" ? 404 : code === "ai_disabled" ? 503 : code === "ai_busy" ? 429
    : ["agent_stale", "agent_decided", "agent_uncertain"].includes(code) ? 409
      : ["agent_invalid_proposal", "agent_context_too_large", "invalid_project", "duplicate_project", "invalid_repeat"].includes(code) ? 422 : 502;
  return Response.json({ error: code }, { status });
}
