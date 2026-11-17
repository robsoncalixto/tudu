import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { aiEnabled } from "@/features/capture/server/capture";
import { listTasks } from "@/features/tasks/server/repository";
import { listProjects } from "@/features/projects/server/repository";
import { getSettings } from "@/features/settings/server/repository";
import { workLogQuerySchema } from "@/features/work-log/schema";
import { summarizeWorkLog, WorkLogError } from "@/features/work-log/server/summary";

export async function POST(request: Request) {
  const parsed = workLogQuerySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_work_log" }, { status: 400 });
  if (!aiEnabled()) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });
  try {
    const [tasks, projects, settings] = await Promise.all([listTasks(), listProjects(), getSettings()]);
    return NextResponse.json({ summary: await summarizeWorkLog(tasks, projects, parsed.data, settings.locale) });
  } catch (error) {
    if (error instanceof WorkLogError) return NextResponse.json({ error: error.code }, { status: error.code === "work_log_ai_failed" ? 502 : 422 });
    if (error instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "ai_auth" }, { status: 502 });
    if (error instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "ai_busy" }, { status: 429 });
    if (error instanceof Anthropic.AnthropicError) return NextResponse.json({ error: "work_log_ai_failed" }, { status: 502 });
    throw error;
  }
}
