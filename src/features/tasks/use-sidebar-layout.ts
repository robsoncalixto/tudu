"use client";

import { useLayoutEffect, useState } from "react";
import { restoreSidebarLayout, type SidebarLayout } from "./board-navigation";

const key = "tudu.sidebarLayout";

export function useSidebarLayout() {
  const [layout, setLayout] = useState(() => restoreSidebarLayout(null));
  const [desktop, setDesktop] = useState(false);
  const compact = desktop && layout.compact;

  useLayoutEffect(() => {
    try { setLayout(restoreSidebarLayout(localStorage.getItem(key))); } catch { /* Device storage is optional. */ }
    const media = matchMedia("(min-width: 821px)");
    const resize = () => setDesktop(media.matches);
    resize();
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);

  function update(patch: Partial<SidebarLayout>) {
    const next = { ...layout, ...patch };
    setLayout(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Keep this session usable. */ }
  }

  function toggleGroup(group: "projects" | "tags") {
    update(compact ? { compact: false, [group]: true } : { [group]: !layout[group] });
  }

  return { layout, compact, update, toggleGroup };
}
