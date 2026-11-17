import { proposalDecisionSchema } from "@/features/agent/schema";
import { proposalRepository } from "@/features/agent/server/repository";
import { decideProposal } from "@/features/agent/server/decide";
import { proposalOperations } from "../../operations";
import { agentFailure } from "../../response";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = proposalDecisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "agent_invalid_proposal" }, { status: 400 });
  try {
    const proposal = await decideProposal(proposalRepository, (await context.params).id, parsed.data, proposalOperations);
    return Response.json({ proposal });
  } catch (error) { return agentFailure(error); }
}
