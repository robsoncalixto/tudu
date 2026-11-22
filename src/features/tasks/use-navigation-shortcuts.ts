"use client";

import { useEffect, useRef } from "react";
import { shortcutsApi } from "@/features/shortcuts/api";
import type { TaskFilter } from "./board-navigation";

interface Options {
  page: string;
  select: (filter: TaskFilter) => void;
  push: (path: string) => void;
}

/**
 * Shortcuts that change screen. The board is not mounted on other pages, so a request to focus
 * its task field or search is kept here until the board appears and picks it up.
 */
export function useNavigationShortcuts(options: Options) {
  const focusRequest = useRef<"composer" | "search" | null>(null);
  const latest = useRef(options);
  latest.current = options;
  useEffect(() => {
    const openBoard = (field: "composer" | "search") => () => {
      if (latest.current.page === "/") return false;
      focusRequest.current = field;
      latest.current.push("/");
    };
    const stops = [
      shortcutsApi.subscribe("newTask", openBoard("composer")),
      shortcutsApi.subscribe("search", openBoard("search")),
      shortcutsApi.subscribe("goAll", () => latest.current.select({ kind: "all" })),
      shortcutsApi.subscribe("goToday", () => latest.current.select({ kind: "today" })),
      shortcutsApi.subscribe("goWorkLog", () => latest.current.push("/work-log")),
      shortcutsApi.subscribe("goAssistant", () => latest.current.push("/agent")),
      shortcutsApi.subscribe("goSettings", () => latest.current.push("/settings")),
    ];
    return () => stops.forEach((stop) => stop());
  }, []);
  return focusRequest;
}
