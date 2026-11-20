import { listTasks, readDayOrder, setDayOrder, addTasks, updateTaskWithNext, deleteTask, TaskChangedError } from "@/features/tasks/server/repository";
import { addProject, listProjects, ProjectError, withValidProjectIds } from "@/features/projects/server/repository";
import { InvalidRepeatError } from "@/features/tasks/recurrence";
import { taskCreationSchema } from "@/features/tasks/schema";
import { isForToday } from "@/features/tasks/selectors";
import { getSettings } from "@/features/settings/server/repository";
import { createTuduMcpHandler } from "@/features/mcp/server/handler";
import { checkMcpAccess } from "@/features/mcp/server/access";
import { mcpCorsResponse, mcpPreflightResponse } from "@/features/mcp/server/cors";
import { McpToolError } from "@/features/mcp/server/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof ProjectError) throw new McpToolError(error.code);
    if (error instanceof InvalidRepeatError) throw new McpToolError("invalid_repeat");
    if (error instanceof TaskChangedError) throw new McpToolError("task_changed");
    throw error;
  }
}
const handler = createTuduMcpHandler({
  listTasks,
  readDayOrder,
  setDayOrder: (order) => guarded(() => setDayOrder(order)),
  isForToday,
  listProjects,
  createProject: (input) => guarded(() => addProject(input)),
  addTasks: (drafts) => guarded(async () => {
    const parsed = taskCreationSchema((await getSettings()).defaultPriority).parse(drafts);
    const inputs = Array.isArray(parsed) ? parsed : [parsed];
    return withValidProjectIds(inputs.map((input) => input.projectId), () => addTasks(inputs));
  }),
  updateTask: (id, patch, expected) => guarded(() => withValidProjectIds([patch.projectId], () => updateTaskWithNext(id, patch, expected))),
  deleteTask,
});

async function serve(request: Request): Promise<Response> {
  const response = checkMcpAccess(request) ?? (request.method === "OPTIONS" ? mcpPreflightResponse() : await handler.fetch(request));
  response.headers.set("Cache-Control", "no-store");
  return mcpCorsResponse(request, response);
}
export const POST = serve;
export const GET = serve;
export const DELETE = serve;
export const OPTIONS = serve;
