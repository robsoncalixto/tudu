import { describe, expect, it } from "vitest";
import { clampPanelWidth, panelWidthRange, resolvePanelWidth, restorePanelWidth } from "./panel-width";

describe("task panel width", () => {
  it("retains 380 pixels for the board and caps the panel on a large screen", () => {
    expect(panelWidthRange(960, 236)).toEqual({ min: 340, max: 344 });
    expect(panelWidthRange(960, 66)).toEqual({ min: 340, max: 514 });
    expect(panelWidthRange(1920, 236)).toEqual({ min: 340, max: 720 });
    const range = panelWidthRange(960, 236);
    expect(clampPanelWidth(200, range)).toBe(340);
    expect(clampPanelWidth(600, range)).toBe(344);
  });

  it("uses the default width or adapts a saved width to the screen", () => {
    expect(resolvePanelWidth(null, 1440, 236)).toBe(461);
    expect(resolvePanelWidth(null, 1920, 236)).toBe(520);
    expect(resolvePanelWidth(620, 960, 236)).toBe(344);
    expect(resolvePanelWidth(620, 1440, 236)).toBe(620);
  });

  it.each([null, "", " ", "0", "-4", "Infinity", "350px", "0xabc"])("ignores damaged saved width %s", (stored) => {
    expect(restorePanelWidth(stored)).toBeNull();
  });

  it("restores a plausible width and clamps out-of-range amounts", () => {
    expect(restorePanelWidth("600")).toBe(600);
    expect(restorePanelWidth("30")).toBe(340);
    expect(restorePanelWidth("1000")).toBe(720);
  });
});
