import { NextResponse } from "next/server";
import { z } from "zod";
import { addTasks, listTasks } from "@/features/tasks/server/repository";
import { taskInputSchema } from "@/features/tasks/schema";

export const dynamic = "force-dynamic";

const bodySchema = z.union([taskInputSchema, z.array(taskInputSchema).min(1).max(50)]);

export async function GET() {
  return NextResponse.json({ tasks: await listTasks() });
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_task" }, { status: 400 });
  }
  const inputs = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
  return NextResponse.json({ tasks: await addTasks(inputs) }, { status: 201 });
}
