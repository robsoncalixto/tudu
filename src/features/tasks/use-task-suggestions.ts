"use client";

import { useEffect, useMemo, useState } from "react";
import { agentApi, watchAgent } from "@/features/agent/api";
import type { AgentState } from "@/features/agent/schema";
import { suggestionsByTask } from "./task-suggestions";

export function useTaskSuggestions() {
  const [snapshot, setSnapshot] = useState<AgentState | null>(null);
  useEffect(() => {
    let active = true;
    let generation = 0;
    async function refresh() {
      const started = ++generation;
      try {
        const next = await agentApi.get();
        if (active && started === generation) setSnapshot(next);
      } catch { /* Preserve existing suggestions during a background failure. */ }
    }
    void refresh();
    const stop = watchAgent(refresh);
    return () => { active = false; stop(); };
  }, []);
  return useMemo(() => ({
    pendingCount: snapshot?.proposals.filter((proposal) => proposal.status === "pending").length ?? 0,
    byTask: suggestionsByTask(snapshot?.proposals ?? [], snapshot?.enabled ?? false),
  }), [snapshot]);
}
