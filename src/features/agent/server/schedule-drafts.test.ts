import { expect, it, vi } from "vitest";
import type { GenerateStructured } from "@/features/ai/schema";
import { taskSchema, type Task } from "@/features/tasks/schema";
import { proposeChanges, reviewOpenTasks } from "./propose";

const today = "2026-11-17";
const tomorrow = "2026-11-18";
const settings = { workingDays: [1, 2, 3, 4, 5], workHoursPerDay: 4 };
const task = (id: string, fields: Partial<Task> = {}) => taskSchema.parse({
  id, title: id, done: false, completedAt: null, createdAt: "2026-11-16T12:00:00Z", ...fields,
});

it("suggests a date based on capacity and keeps an explicitly requested period", async () => {
  const generate = vi.fn<GenerateStructured>().mockResolvedValue({ proposals: [{
    kind: "create_task", reason: "Evening report.",
    task: { title: "Report", notes: "", priority: "high", due: null, tags: [], steps: [],
      projectId: null, plannedFor: null, estimateHours: null, partOfDay: "evening" },
  }] });
  const drafts = await proposeChanges(generate as GenerateStructured, "Write the report in the evening", today,
    [task("Full day", { due: today, estimateHours: 4 })], [], "en", "medium", settings);
  expect(drafts[0]).toMatchObject({ action: { task: { due: tomorrow, plannedFor: tomorrow, partOfDay: "evening" } } });
  expect(drafts[0].reason).toContain("1 hour of effort");
});

it("flags overload in Portuguese and suggests at most three nonconflicting moves without changing deadlines", async () => {
  const generate = vi.fn<GenerateStructured>().mockResolvedValue({
    summary: "Revisei as tarefas.", proposals: [{ kind: "set_priority", taskId: "Pending", priority: "high", reason: "Urgente." }],
  });
  const tasks = [
    task("Fixed", { due: today, plannedFor: today, estimateHours: 4 }),
    task("Pending", { plannedFor: today, priority: "low" }),
    task("Movable", { due: tomorrow, plannedFor: today, priority: "low", partOfDay: "evening" }),
    task("First"), task("Second"), task("Third"), task("Fourth", { done: true }),
  ];
  const review = await reviewOpenTasks(generate as GenerateStructured, "", today, tasks, [], "pt-BR", settings);
  expect(review.summary).toContain("1 dia está acima da capacidade");
  expect(review.drafts.map(({ action }) => action)).toMatchObject([
    { taskId: "Pending", patch: { priority: "high" } },
    { taskId: "Movable", patch: { plannedFor: tomorrow, partOfDay: "evening" } },
    { taskId: "First", patch: { plannedFor: tomorrow } },
    { taskId: "Second", patch: { plannedFor: tomorrow } },
  ]);
  for (const { action } of review.drafts) {
    if (action.kind === "update_task") expect(action.patch).not.toHaveProperty("due");
  }
});
