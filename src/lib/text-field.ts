type TextField = HTMLTextAreaElement | HTMLInputElement;

/**
 * Replaces part of a field's text the way typing would, so the browser keeps its undo history.
 * Returns false when the browser refuses, leaving the caller to set the value itself.
 */
export function replaceFieldText(field: TextField, start: number, end: number, text: string): boolean {
  field.focus({ preventScroll: true });
  if (start === end && !text) return true;
  field.setSelectionRange(start, end);
  try {
    return document.execCommand(text ? "insertText" : "delete", false, text);
  } catch {
    return false;
  }
}
