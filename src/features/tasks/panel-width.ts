const MIN_WIDTH = 340;
const MAX_WIDTH = 720;
const BOARD_MIN_WIDTH = 380;

export function panelWidthRange(viewport: number, sidebar: number) {
  return { min: MIN_WIDTH, max: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, viewport - sidebar - BOARD_MIN_WIDTH)) };
}

export function clampPanelWidth(width: number, range: ReturnType<typeof panelWidthRange>): number {
  return Math.min(range.max, Math.max(range.min, Math.round(width)));
}

export function restorePanelWidth(value: string | null): number | null {
  const saved = value?.trim();
  if (!saved || !/^\d+$/.test(saved)) return null;
  const width = Number(saved);
  if (!Number.isFinite(width) || width <= 0) return null;
  return clampPanelWidth(width, { min: MIN_WIDTH, max: MAX_WIDTH });
}

export function resolvePanelWidth(preferred: number | null, viewport: number, sidebar: number): number {
  const defaultWidth = Math.min(viewport * 0.32, 520);
  return clampPanelWidth(preferred ?? defaultWidth, panelWidthRange(viewport, sidebar));
}
