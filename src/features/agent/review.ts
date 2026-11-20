import type { Project } from "@/features/projects/schema";
import type { Task } from "@/features/tasks/schema";
import type { Proposal, ProposalDraft } from "./schema";

function urgency(task: Task, today: string) {
  if (task.due && task.due <= today) return 0;
  if (task.plannedFor && task.plannedFor <= today) return 1;
  return task.priority === "high" ? 2 : 3;
}

function withinBudget<T>(items: T[], limit: number): T[] {
  let remaining = limit;
  const selected: T[] = [];
  for (const item of items) {
    const size = JSON.stringify(item).length + 1;
    if (size > remaining) break;
    remaining -= size;
    selected.push(item);
  }
  return selected;
}

export function taskReviewContext(tasks: Task[], projects: Project[], today: string, note: string) {
  const open = tasks.filter((task) => !task.done);
  const ordered = open.sort((a, b) => urgency(a, today) - urgency(b, today)
    || (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.createdAt.localeCompare(b.createdAt));
  const candidates = ordered.map(({ id, title, notes, due, plannedFor, priority, projectId, estimateHours, realTimeHours, tags, steps }) => ({
    id, title, notes: notes.slice(0, 700), due, plannedFor, priority, projectId, estimateHours, realTimeHours, tags,
    stepCount: steps.length, steps: steps.slice(0, 8).map(({ title, done }) => ({ title: title.slice(0, 100), done })),
  }));
  const assigned = new Set(ordered.map((task) => task.projectId));
  const offeredProjects = withinBudget([...projects].sort((a, b) => Number(assigned.has(b.id)) - Number(assigned.has(a.id))), 8_000);
  const offeredTasks = withinBudget(candidates, 59_000 - JSON.stringify(note).length - JSON.stringify(offeredProjects).length);
  return { today, projects: offeredProjects, tasks: offeredTasks, openTasks: open.length, omittedTasks: open.length - offeredTasks.length };
}

function pendingKeys(draft: ProposalDraft): string[] {
  const action = draft.action;
  if (action.kind === "flag_duplicate") {
    return [JSON.stringify(["duplicate", ...[action.taskId, action.otherTaskId].sort()])];
  }
  if (action.kind === "update_task") return Object.keys(action.patch).map((field) => JSON.stringify(["task", action.taskId, field]));
  return [];
}

export function withoutPendingDuplicates(drafts: ProposalDraft[], proposals: Proposal[]): ProposalDraft[] {
  const pending = new Set(proposals.filter(({ status }) => status === "pending" || status === "applying").flatMap(pendingKeys));
  return drafts.filter((draft) => {
    const keys = pendingKeys(draft);
    if (keys.some((key) => pending.has(key))) return false;
    keys.forEach((key) => pending.add(key));
    return true;
  });
}
