import type { Step } from "./schema";

export function stepProgress(steps: Step[]) {
  return { done: steps.filter((step) => step.done).length, total: steps.length };
}

export function createStep(title: string): Step {
  // getRandomValues also works when the app is served over HTTP on the LAN.
  return { id: crypto.getRandomValues(new Uint32Array(4)).join("-"), title: title.trim(), done: false };
}
