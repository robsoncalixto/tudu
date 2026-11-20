import { automaticReviewDay } from "@/features/agent/automatic-review";
import { proposalRepository } from "@/features/agent/server/repository";
import { reviewOpenTasks } from "@/features/agent/server/propose";
import { reviewState, serializeReview, setAutomaticRunning, taskFingerprint } from "@/features/agent/server/review-state";
import { aiPublicConfiguration } from "@/features/ai/server/configuration";
import { createGenerator } from "@/features/ai/server/generate";
import { listProjects } from "@/features/projects/server/repository";
import { getSettings } from "@/features/settings/server/repository";
import { listTasks } from "@/features/tasks/server/repository";

const server = globalThis as typeof globalThis & { tuduAutomaticReviewTimer?: ReturnType<typeof setInterval> };

export function startAutomaticReview() {
  if (server.tuduAutomaticReviewTimer) return;
  let checking = false;
  async function tick() {
    if (checking) return;
    checking = true;
    try {
      const snapshot = await getSettings();
      if (!snapshot.automaticReview.enabled || !aiPublicConfiguration().available[snapshot.aiProvider]) return;
      await serializeReview(async () => {
        const settings = await getSettings();
        const config = aiPublicConfiguration();
        if (!config.available[settings.aiProvider]) return;
        const now = new Date();
        const last = await reviewState.read();
        const day = automaticReviewDay(now, settings.automaticReview, last.status?.ranAt ?? null);
        if (!day) return;
        const tasks = await listTasks();
        const fingerprint = taskFingerprint(tasks);
        if (!tasks.some((task) => !task.done) || last.fingerprint === fingerprint) return;

        const ranAt = now.toISOString();
        const status = { ranAt, outcome: "running" as const };
        setAutomaticRunning(true);
        try {
          await reviewState.write({ ...last, status });
          const projects = await listProjects();
          const { drafts, summary } = await reviewOpenTasks(createGenerator(settings), "", day, tasks, projects, settings.locale);
          await proposalRepository.addProposals(drafts, {
            note: "", today: day, review: true, provider: settings.aiProvider,
            model: settings.aiModel || config.models[settings.aiProvider],
          });
          await reviewState.write({ fingerprint, status: { ranAt, outcome: "succeeded", summary } });
        } catch (error) {
          console.error("Automatic task review failed", error instanceof Error ? error.name : "Unknown error");
          await reviewState.write({ ...last, status: { ranAt, outcome: "failed" } });
        } finally { setAutomaticRunning(false); }
      });
    } catch (error) {
      console.error("Automatic task review could not check its schedule", error instanceof Error ? error.name : "Unknown error");
    } finally { checking = false; }
  }
  server.tuduAutomaticReviewTimer = setInterval(() => { void tick(); }, 10_000);
  server.tuduAutomaticReviewTimer.unref();
  void tick();
}
