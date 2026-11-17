import { NextResponse } from "next/server";
import { deleteTask, updateTaskWithNext } from "@/features/tasks/server/repository";
import { InvalidRepeatError } from "@/features/tasks/recurrence";
import { taskPatchSchema } from "@/features/tasks/schema";
import { ProjectError, withValidProjectIds } from "@/features/projects/server/repository";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const parsed = taskPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_task" }, { status: 400 });
  }
  try {
    const result = await withValidProjectIds([parsed.data.projectId], () => updateTaskWithNext(id, parsed.data));
    if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InvalidRepeatError) return NextResponse.json({ error: "invalid_repeat" }, { status: 400 });
    if (error instanceof ProjectError) return NextResponse.json({ error: error.code }, { status: 400 });
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!(await deleteTask(id))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
