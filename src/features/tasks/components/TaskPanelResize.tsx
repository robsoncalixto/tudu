"use client";

import { useRef } from "react";
import type { usePanelWidth } from "../use-panel-width";

const STEP = 16;

export function TaskPanelResize({ label, size }: { label: string; size: ReturnType<typeof usePanelWidth> }) {
  const drag = useRef<{ origin: number; width: number } | null>(null);
  if (!size.ready) return null;

  return <div className="inspector-resize-position">
    <div className="inspector-resize" role="separator" tabIndex={0} aria-label={label}
      aria-controls="task-inspector" aria-orientation="vertical" aria-valuemin={size.range.min}
      aria-valuemax={size.range.max} aria-valuenow={size.width}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        drag.current = { origin: event.clientX, width: size.width };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (drag.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
          size.setPreview(drag.current.width + drag.current.origin - event.clientX);
        }
      }}
      onPointerUp={(event) => {
        if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const { origin, width } = drag.current;
        drag.current = null;
        if (origin !== event.clientX) size.finish(width + origin - event.clientX);
        else size.setPreview(null);
      }}
      onLostPointerCapture={() => { drag.current = null; size.setPreview(null); }}
      onDoubleClick={() => size.finish(null)}
      onKeyDown={(event) => {
        const next = event.key === "ArrowLeft" ? size.width + STEP
          : event.key === "ArrowRight" ? size.width - STEP
          : event.key === "Home" ? size.range.min
          : event.key === "End" ? size.range.max : null;
        if (next === null) return;
        event.preventDefault();
        size.finish(next);
      }} />
  </div>;
}
