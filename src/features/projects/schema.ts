import { z } from "zod";

export const projectIdSchema = z.uuid().nullable();
export const projectInputSchema = z.object({ name: z.string().trim().min(1).max(80) });
export const projectSchema = projectInputSchema.extend({ id: z.uuid() });
export type Project = z.infer<typeof projectSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;

export function projectNameKey(name: string): string {
  return name.trim().normalize("NFKC").toLowerCase();
}
