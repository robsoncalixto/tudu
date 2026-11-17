import { NextResponse } from "next/server";
import { deleteTask, updateTask } from "@/features/tasks/server/repository";
import { taskPatchSchema } from "@/features/tasks/schema";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const parsed = taskPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_task" }, { status: 400 });
  }
  const task = await updateTask(id, parsed.data);
  if (!task) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!(await deleteTask(id))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
