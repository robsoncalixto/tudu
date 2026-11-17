import { z } from "zod";
import { taskSchema } from "./schema";

export const shortcutActionSchema = z.enum(["composer", "leave-composer", "next", "previous", "toggle", "delete", "help"]);
export type ShortcutAction = z.infer<typeof shortcutActionSchema>;
export const shortcutDialogSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("help") }),
  taskSchema.pick({ id: true, title: true }).extend({ kind: z.literal("delete") }),
]);
export type ShortcutDialog = z.infer<typeof shortcutDialogSchema>;
