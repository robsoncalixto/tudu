import { NextResponse } from "next/server";
import { projectInputSchema } from "@/features/projects/schema";
import { deleteProject, ProjectError, updateProject } from "@/features/projects/server/repository";
import { clearTaskProject } from "@/features/tasks/server/repository";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const parsed = projectInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_project" }, { status: 400 });
  try {
    const project = await updateProject(id, parsed.data);
    return project ? NextResponse.json({ project }) : NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch (error) {
    if (error instanceof ProjectError) return NextResponse.json({ error: error.code }, { status: 409 });
    throw error;
  }
}
export async function DELETE(_request: Request, { params }: Context) {
  if (!await deleteProject((await params).id, clearTaskProject)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
