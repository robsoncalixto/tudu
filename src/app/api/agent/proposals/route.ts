import { getSettings } from "@/features/settings/server/repository";
import { aiPublicConfiguration } from "@/features/ai/server/configuration";
import { createGenerator } from "@/features/ai/server/generate";
import { listTasks } from "@/features/tasks/server/repository";
import { listProjects } from "@/features/projects/server/repository";
import { proposalRepository } from "@/features/agent/server/repository";
import { proposeChanges } from "@/features/agent/server/propose";
import { proposalRequestSchema } from "@/features/agent/schema";
import { agentFailure } from "../response";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const [proposals, projects, settings] = await Promise.all([
      proposalRepository.listProposals(), listProjects(), getSettings(),
    ]);
    return Response.json({ proposals, projects, enabled: aiPublicConfiguration().available[settings.aiProvider] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return agentFailure(error); }
}
export async function POST(request: Request) {
  const parsed = proposalRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "agent_invalid_proposal" }, { status: 400 });
  try {
    const settings = await getSettings();
    const config = aiPublicConfiguration();
    if (!config.available[settings.aiProvider]) return Response.json({ error: "ai_disabled" }, { status: 503 });
    const [tasks, projects] = await Promise.all([listTasks(), listProjects()]);
    const drafts = await proposeChanges(createGenerator(settings), parsed.data.text, parsed.data.today, tasks, projects, settings.locale, settings.defaultPriority);
    const proposals = await proposalRepository.addProposals(drafts, {
      note: parsed.data.text, today: parsed.data.today, provider: settings.aiProvider,
      model: settings.aiModel || config.models[settings.aiProvider],
    });
    return Response.json({ proposals }, { status: 201 });
  } catch (error) { return agentFailure(error); }
}
