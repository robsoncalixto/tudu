import { getSettings } from "@/features/settings/server/repository";
import { aiPublicConfiguration } from "@/features/ai/server/configuration";
import { createGenerator } from "@/features/ai/server/generate";
import { listTasks } from "@/features/tasks/server/repository";
import { listProjects } from "@/features/projects/server/repository";
import { proposalRepository } from "@/features/agent/server/repository";
import { proposeChanges, reviewOpenTasks } from "@/features/agent/server/propose";
import { getAutomaticStatus, rememberManualReview, serializeReview } from "@/features/agent/server/review-state";
import { proposalRequestSchema } from "@/features/agent/schema";
import { agentFailure } from "../response";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const [proposals, projects, settings, automaticReview] = await Promise.all([
      proposalRepository.listProposals(), listProjects(), getSettings(), getAutomaticStatus(),
    ]);
    return Response.json({ proposals, projects, automaticReview, enabled: aiPublicConfiguration().available[settings.aiProvider] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return agentFailure(error); }
}
export async function POST(request: Request) {
  const parsed = proposalRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "agent_invalid_proposal" }, { status: 400 });
  try {
    return await serializeReview(async () => {
      const settings = await getSettings();
      const config = aiPublicConfiguration();
      if (!config.available[settings.aiProvider]) return Response.json({ error: "ai_disabled" }, { status: 503 });
      const [tasks, projects] = await Promise.all([listTasks(), listProjects()]);
      const { text, today, review } = parsed.data;
      const generate = createGenerator(settings);
      const reviewed = review ? await reviewOpenTasks(generate, text, today, tasks, projects, settings.locale, settings) : null;
      const drafts = reviewed?.drafts ?? await proposeChanges(generate, text, today, tasks, projects, settings.locale, settings.defaultPriority, settings);
      const proposals = await proposalRepository.addProposals(drafts, {
        note: text, today, ...(review ? { review } : {}), provider: settings.aiProvider,
        model: settings.aiModel || config.models[settings.aiProvider],
      });
      if (review) await rememberManualReview(tasks);
      return Response.json({ proposals, ...(reviewed ? { summary: reviewed.summary } : {}) }, { status: 201 });
    });
  } catch (error) { return agentFailure(error); }
}
