"use client";

import { useEffect, useState } from "react";
import { agentApi, watchAgent } from "@/features/agent/api";

export function usePendingSuggestions() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let current = true;
    let loading = false;
    async function read() {
      if (loading) return;
      loading = true;
      try {
        const { proposals } = await agentApi.get();
        if (current) setCount(proposals.filter((proposal) => proposal.status === "pending").length);
      } catch { /* Keep the last count during a transient failure. */ }
      finally { loading = false; }
    }
    void read();
    const stop = watchAgent(read);
    return () => { current = false; stop(); };
  }, []);
  return count;
}
