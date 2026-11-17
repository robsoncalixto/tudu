"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dictionary } from "@/i18n";
import { tasksApi } from "@/features/tasks/api";
import { projectsApi } from "@/features/projects/api";
import { captureApi } from "@/features/capture/api";
import type { Task } from "@/features/tasks/schema";
import type { Project } from "@/features/projects/schema";
import { copyText } from "@/lib/clipboard";
import { errorCode } from "@/lib/http";
import { useToday } from "@/lib/use-today";
import { workLogApi } from "./api";
import { completedOn, groupWorkLog } from "./selectors";
import { formatWorkLog } from "./format";
import type { Grouping } from "./schema";

export function useWorkLog(t: Dictionary) {
  const today = useToday();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const day = selectedDay ?? today ?? "";
  const [timeZone, setTimeZone] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [grouping, setGrouping] = useState<Grouping>("project");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<"copied" | "generated" | null>(null);
  const [manualCopy, setManualCopy] = useState<string | null>(null);
  const revision = useRef(0);
  const loadingRequest = useRef(0);

  const reload = useCallback(async () => {
    const request = ++loadingRequest.current;
    revision.current++;
    setLoading(true); setLoadError(false); setSummary(""); setError(null); setNotice(null); setManualCopy(null); setBusy(false);
    try {
      const [tasks, projects] = await Promise.all([tasksApi.list(), projectsApi.list()]);
      if (request !== loadingRequest.current) return;
      setTasks(tasks); setProjects(projects);
    } catch { if (request === loadingRequest.current) setLoadError(true); }
    finally { if (request === loadingRequest.current) setLoading(false); }
  }, []);

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    void reload();
    let active = true;
    captureApi.status().then((enabled) => { if (active) setAiEnabled(enabled); }).catch(() => undefined);
    return () => { active = false; loadingRequest.current++; revision.current++; };
  }, [reload]);

  useEffect(() => {
    revision.current++;
    setSummary(""); setError(null); setNotice(null); setManualCopy(null); setBusy(false);
  }, [day, timeZone]);

  const completed = useMemo(() => completedOn(tasks, { day, timeZone }), [tasks, day, timeZone]);
  const groups = useMemo(() => groupWorkLog(completed, projects, grouping), [completed, projects, grouping]);

  async function copy(mode: "text" | "markdown") {
    const current = revision.current;
    const text = formatWorkLog(day, groups, mode, t, summary);
    setCopying(true); setError(null); setNotice(null); setManualCopy(null);
    try {
      await copyText(text);
      if (current === revision.current) setNotice("copied");
    } catch {
      if (current === revision.current) { setError("copy_failed"); setManualCopy(text); }
    } finally { setCopying(false); }
  }

  async function summarize() {
    const current = ++revision.current;
    setBusy(true); setError(null); setNotice(null);
    try {
      const summary = await workLogApi.summarize({ day, timeZone });
      if (current === revision.current) { setSummary(summary); setNotice("generated"); }
    } catch (error) { if (current === revision.current) setError(errorCode(error)); }
    finally { if (current === revision.current) setBusy(false); }
  }

  return {
    day, setDay: setSelectedDay, timeZone, grouping,
    setGrouping: (grouping: Grouping) => { setGrouping(grouping); setManualCopy(null); setNotice(null); setError(null); },
    loading, loadError, reload,
    completed, groups, summary, aiEnabled, summarize, busy, copy, copying, manualCopy, error, notice,
  };
}
