import type { Step } from "./schema";

export function stepProgress(steps: Step[]) {
  return { done: steps.filter((step) => step.done).length, total: steps.length };
}

export type SubtaskVisibility = "all" | "open" | "collapsed";

export function nextSubtaskVisibility(mode: SubtaskVisibility, { done, total }: ReturnType<typeof stepProgress>): SubtaskVisibility {
  if (mode === "collapsed" || (mode === "open" && done === total)) return "all";
  if (mode === "all" && done > 0 && done < total) return "open";
  return "collapsed";
}

export function createStep(title: string): Step {
  // getRandomValues also works when the app is served over HTTP on the LAN.
  return { id: crypto.getRandomValues(new Uint32Array(4)).join("-"), title: title.trim(), done: false };
}
