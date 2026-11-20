import { z } from "zod";
import { dayOrderRequestSchema } from "@/features/tasks/schema";
import { readDayOrder, setDayOrder, TaskChangedError } from "@/features/tasks/server/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsed = z.iso.date().safeParse(new URL(request.url).searchParams.get("day"));
  if (!parsed.success) return Response.json({ error: "invalid_task" }, { status: 400 });
  return Response.json({ order: await readDayOrder(parsed.data) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const parsed = dayOrderRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_task" }, { status: 400 });
  try {
    return Response.json({ order: await setDayOrder(parsed.data) });
  } catch (error) {
    if (error instanceof TaskChangedError) return Response.json({ error: "task_changed" }, { status: 409 });
    throw error;
  }
}
