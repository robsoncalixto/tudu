import { z } from "zod";
import { PRIORITIES } from "@/features/tasks/schema";

const id = z.string();
const date = z.string().nullable();
const reason = z.string().min(1).max(1000);
const task = z.object({
  title: z.string().min(1).max(300), notes: z.string().max(2000), priority: z.enum(PRIORITIES),
  due: date, tags: z.array(z.string().min(1).max(40)).max(10), steps: z.array(z.string().min(1).max(300)).max(100),
  projectId: id.nullable(), plannedFor: date,
}).strict();
export const agentPlanSchema = z.object({ proposals: z.array(z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("create_task"), task, reason }).strict(),
  z.object({ kind: z.literal("set_priority"), taskId: id, priority: z.enum(PRIORITIES), reason }).strict(),
  z.object({ kind: z.literal("set_due"), taskId: id, due: date, reason }).strict(),
  z.object({ kind: z.literal("set_project"), taskId: id, projectId: id.nullable(), reason }).strict(),
  z.object({ kind: z.literal("plan_task"), taskId: id, plannedFor: date, reason }).strict(),
  z.object({ kind: z.literal("add_steps"), taskId: id, steps: z.array(z.string().min(1).max(300)).min(1).max(100), reason }).strict(),
  z.object({ kind: z.literal("create_project"), name: z.string().min(1).max(80), reason }).strict(),
  z.object({ kind: z.literal("rename_project"), projectId: id, name: z.string().min(1).max(80), reason }).strict(),
])).max(20) }).strict();
export type AgentPlan = z.infer<typeof agentPlanSchema>;
