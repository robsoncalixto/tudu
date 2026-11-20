const GAP = 4;

/** Places an open popover under its trigger, or above it when the viewport has no room below. */
export function placeBelow(popup: HTMLElement, anchor: DOMRect) {
  const bounds = popup.getBoundingClientRect();
  const below = anchor.bottom + GAP;
  const top = below + bounds.height <= window.innerHeight - GAP ? below : anchor.top - bounds.height - GAP;
  popup.style.left = `${Math.max(GAP, Math.min(anchor.left, document.documentElement.clientWidth - bounds.width - GAP))}px`;
  popup.style.top = `${Math.max(GAP, top)}px`;
}
