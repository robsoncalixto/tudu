import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { aiEnabled, CaptureRefusedError, captureTasks } from "@/features/capture/server/capture";
import { addTasks } from "@/features/tasks/server/repository";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(8000),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET() {
  return NextResponse.json({ enabled: aiEnabled() });
}

export async function POST(request: Request) {
  if (!aiEnabled()) {
    return NextResponse.json({ error: "ai_disabled" }, { status: 503 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_note" }, { status: 400 });
  }

  try {
    const drafts = await captureTasks(parsed.data.text, parsed.data.today);
    if (drafts.length === 0) {
      return NextResponse.json({ error: "no_tasks" }, { status: 422 });
    }
    return NextResponse.json({ tasks: await addTasks(drafts) }, { status: 201 });
  } catch (error) {
    if (error instanceof CaptureRefusedError) {
      return NextResponse.json({ error: "no_tasks" }, { status: 422 });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "ai_auth" }, { status: 502 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "ai_busy" }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("AI capture failed", error.status, error.message);
      return NextResponse.json({ error: "ai_failed" }, { status: 502 });
    }
    throw error;
  }
}
