export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build" || process.argv.includes("build")) return;
  const { startAutomaticReview } = await import("./app/server/automatic-review");
  startAutomaticReview();
}
