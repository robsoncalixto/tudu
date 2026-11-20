"use client";

import { useLayoutEffect, useState, type RefObject } from "react";
import { clampPanelWidth, panelWidthRange, resolvePanelWidth, restorePanelWidth } from "./panel-width";

const STORAGE_KEY = "tudu.taskPanelWidth";

export function usePanelWidth(panel: RefObject<HTMLDialogElement | null>) {
  const [preferred, setPreferred] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState<{ board: number; sidebar: number } | null>(null);
  const [preview, setPreview] = useState<number | null>(null);

  useLayoutEffect(() => {
    try { setPreferred(restorePanelWidth(localStorage.getItem(STORAGE_KEY))); } catch { /* Device storage is optional. */ }
    const shell = panel.current?.closest<HTMLElement>(".shell");
    if (!shell) return;
    const sidebar = shell.querySelector<HTMLElement>(":scope > .sidebar");
    const measure = () => setDimensions({ board: shell.clientWidth, sidebar: sidebar?.offsetWidth ?? 0 });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(shell);
    if (sidebar) observer.observe(sidebar);
    return () => observer.disconnect();
  }, [panel]);

  const { board, sidebar } = dimensions ?? { board: 960, sidebar: 236 };
  const range = panelWidthRange(board, sidebar);
  const width = resolvePanelWidth(preview ?? preferred, board, sidebar);

  function finish(value: number | null) {
    const next = value === null ? null : clampPanelWidth(value, range);
    setPreferred(next);
    setPreview(null);
    try {
      if (next === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, String(next));
    } catch { /* Keep the width for this panel session. */ }
  }

  return { range, width, ready: dimensions !== null, setPreview, finish };
}
