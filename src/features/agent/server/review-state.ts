import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { taskSchema, type Task } from "@/features/tasks/schema";
import { automaticReviewStatusSchema } from "../schema";

const storedState = z.object({
  status: automaticReviewStatusSchema.nullable(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
});
type StoredReviewState = z.infer<typeof storedState>;

export function taskFingerprint(tasks: Task[]) {
  return createHash("sha256").update(JSON.stringify(tasks.map((task) => taskSchema.parse(task)))).digest("hex");
}

export function createReviewState(dataDir: string) {
  const file = path.join(dataDir, "agent-review.json");
  const repository = {
    async read(recoverAt?: string): Promise<StoredReviewState> {
      try { return storedState.parse(JSON.parse(await readFile(file, "utf8"))); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return { status: null, fingerprint: null };
        if (!recoverAt || !(error instanceof SyntaxError || error instanceof z.ZodError)) throw error;
        await rename(file, `${file}.corrupt-${randomUUID()}`);
        console.error("Preserved an invalid automatic review status file");
        const status = { ranAt: recoverAt, outcome: "failed" as const };
        const recovered = { status, fingerprint: null };
        await repository.write(recovered);
        return recovered;
      }
    },
    async write(next: StoredReviewState): Promise<void> {
      const temporary = `${file}.${process.pid}.tmp`;
      await mkdir(dataDir, { recursive: true });
      await writeFile(temporary, JSON.stringify(storedState.parse(next), null, 2), { mode: 0o600 });
      await rename(temporary, file);
    },
  };
  return repository;
}

const state = globalThis as typeof globalThis & { tuduReviewQueue?: Promise<unknown>; tuduAutomaticRunning?: boolean };
export const reviewState = createReviewState(process.env.DATA_DIR ?? path.join(process.cwd(), "data"));

export function serializeReview<T>(operation: () => Promise<T>): Promise<T> {
  const run = (state.tuduReviewQueue ?? Promise.resolve()).then(operation, operation);
  state.tuduReviewQueue = run.catch(() => undefined);
  return run;
}

export function setAutomaticRunning(running: boolean) { state.tuduAutomaticRunning = running; }

export async function getAutomaticStatus() {
  try {
    const { status } = await reviewState.read();
    return status?.outcome === "running" && !state.tuduAutomaticRunning ? { ...status, outcome: "failed" as const } : status;
  } catch (error) {
    console.error("Automatic task review status unavailable", error instanceof Error ? error.name : "Unknown error");
    return null;
  }
}

export async function rememberManualReview(tasks: Task[]) {
  try { await reviewState.write({ ...(await reviewState.read(new Date().toISOString())), fingerprint: taskFingerprint(tasks) }); }
  catch (error) {
    console.error("Could not remember reviewed tasks", error instanceof Error ? error.name : "Unknown error");
  }
}
