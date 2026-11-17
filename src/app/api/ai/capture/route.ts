import { NextResponse } from "next/server";
import { z } from "zod";
import { captureTasks } from "@/features/capture/server/capture";
import { AiError } from "@/features/ai/schema";
import { aiPublicConfiguration } from "@/features/ai/server/configuration";
import { createGenerator } from "@/features/ai/server/generate";
import { addTasks } from "@/features/tasks/server/repository";
import { listProjects, ProjectError, withValidProjectIds } from "@/features/projects/server/repository";
import { getSettings } from "@/features/settings/server/repository";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(8000),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({ enabled: aiPublicConfiguration().available[settings.aiProvider] });
}

export async function POST(request: Request) {
  const settings = await getSettings();
  if (!aiPublicConfiguration().available[settings.aiProvider]) {
    return NextResponse.json({ error: "ai_disabled" }, { status: 503 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_note" }, { status: 400 });
  }

  try {
    const projects = await listProjects();
    const drafts = await captureTasks(createGenerator(settings), parsed.data.text, parsed.data.today, projects, settings.defaultPriority);
    if (drafts.length === 0) {
      return NextResponse.json({ error: "no_tasks" }, { status: 422 });
    }
    const tasks = await withValidProjectIds(drafts.map((draft) => draft.projectId), () => addTasks(drafts));
    return NextResponse.json({ tasks }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectError) return NextResponse.json({ error: error.code }, { status: 400 });
    if (error instanceof AiError) {
      return NextResponse.json({ error: error.code === "ai_refused" ? "no_tasks" : error.code }, {
        status: error.code === "ai_refused" ? 422 : error.code === "ai_disabled" ? 503 : error.code === "ai_busy" ? 429 : 502,
      });
    }
    throw error;
  }
}
