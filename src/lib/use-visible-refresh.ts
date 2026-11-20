"use client";

import { useEffect } from "react";

const POLL_MS = 10_000;

export function useVisibleRefresh(load: (isCurrent: () => boolean) => Promise<void>, attempt = 0) {
  useEffect(() => {
    let active = true;
    let inFlight = false;
    let queued = false;
    async function refresh() {
      if (!active || document.visibilityState !== "visible") return;
      if (inFlight) { queued = true; return; }
      inFlight = true;
      try { await load(() => active); }
      finally {
        inFlight = false;
        if (queued) { queued = false; void refresh(); }
      }
    }
    void refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const interval = window.setInterval(refresh, POLL_MS);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(interval);
    };
  }, [load, attempt]);
}
