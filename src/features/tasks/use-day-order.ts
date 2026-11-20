"use client";

import { useRef, useState } from "react";
import { errorCode } from "@/lib/http";
import { moveDayTask } from "./day-order";

export const TASK_ORDER_DRAG_TYPE = "application/x-tudu-task-order";

export interface DayOrderControl {
  positions: ReadonlyMap<string, number>;
  ready: boolean;
  size: number;
  move: (id: string, to: number) => void;
}

export function useDayOrder(day: string | null, ids: string[], enabled: boolean,
  save: (day: string, ids: string[], expected: string[]) => Promise<void>, onError: (code: string) => void): DayOrderControl | undefined {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  if (!enabled || !day) return undefined;
  const positions = new Map(ids.map((id, index) => [id, index]));
  return {
    positions, size: ids.length, ready: !busy,
    move(id, to) {
      const target = ids[to];
      if (pending.current || !target || id === target) return;
      const next = moveDayTask(ids, id, target);
      if (next === ids) return;
      pending.current = true;
      setBusy(true);
      void save(day, next, ids).catch((error) => onError(errorCode(error))).finally(() => {
        pending.current = false; setBusy(false);
      });
    },
  };
}
