import { NextResponse } from "next/server";
import { projectInputSchema } from "@/features/projects/schema";
import { addProject, listProjects, ProjectError } from "@/features/projects/server/repository";

export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ projects: await listProjects() }); }
export async function POST(request: Request) {
  const parsed = projectInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_project" }, { status: 400 });
  try {
    return NextResponse.json({ project: await addProject(parsed.data) }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectError) return NextResponse.json({ error: error.code }, { status: 409 });
    throw error;
  }
}
