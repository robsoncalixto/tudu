import { z } from "zod";

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

const dueDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  notes: z.string().trim().max(2000).default(""),
  priority: z.enum(PRIORITIES).default("medium"),
  due: dueDate.default(null),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
});

export const taskPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    notes: z.string().trim().max(2000),
    priority: z.enum(PRIORITIES),
    due: dueDate,
    tags: z.array(z.string().trim().min(1).max(40)).max(10),
    done: z.boolean(),
  })
  .partial();

export type TaskInput = z.infer<typeof taskInputSchema>;
export type TaskPatch = z.infer<typeof taskPatchSchema>;

export interface Task extends TaskInput {
  id: string;
  done: boolean;
  createdAt: string;
  completedAt: string | null;
}
