import { NextResponse } from "next/server";
import { AiError } from "@/features/ai/schema";
import { aiPublicConfiguration } from "@/features/ai/server/configuration";
import { createGenerator } from "@/features/ai/server/generate";
import { listTasks } from "@/features/tasks/server/repository";
import { listProjects } from "@/features/projects/server/repository";
import { getSettings } from "@/features/settings/server/repository";
import { workLogQuerySchema } from "@/features/work-log/schema";
import { summarizeWorkLog, WorkLogError } from "@/features/work-log/server/summary";

export async function POST(request: Request) {
  const parsed = workLogQuerySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_work_log" }, { status: 400 });
  try {
    const settings = await getSettings();
    if (!aiPublicConfiguration().available[settings.aiProvider]) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });
    const [tasks, projects] = await Promise.all([listTasks(), listProjects()]);
    return NextResponse.json({ summary: await summarizeWorkLog(createGenerator(settings), tasks, projects, parsed.data, settings.locale) });
  } catch (error) {
    if (error instanceof WorkLogError) return NextResponse.json({ error: error.code }, { status: error.code === "work_log_ai_failed" ? 502 : 422 });
    if (error instanceof AiError) {
      const code = error.code === "ai_failed" || error.code === "ai_refused" ? "work_log_ai_failed" : error.code;
      return NextResponse.json({ error: code }, { status: code === "ai_disabled" ? 503 : code === "ai_busy" ? 429 : 502 });
    }
    throw error;
  }
}
