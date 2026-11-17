import { NextResponse } from "next/server";
import { addTasks, listTasks } from "@/features/tasks/server/repository";
import { taskCreationSchema } from "@/features/tasks/schema";
import { ProjectError, withValidProjectIds } from "@/features/projects/server/repository";
import { getSettings } from "@/features/settings/server/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ tasks: await listTasks() });
}

export async function POST(request: Request) {
  const settings = await getSettings();
  const parsed = taskCreationSchema(settings.defaultPriority).safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_task" }, { status: 400 });
  }
  const inputs = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
  try {
    const tasks = await withValidProjectIds(inputs.map((input) => input.projectId), () => addTasks(inputs));
    return NextResponse.json({ tasks }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectError) return NextResponse.json({ error: error.code }, { status: 400 });
    throw error;
  }
}
