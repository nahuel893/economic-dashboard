import { describe, expect, it } from "vitest";
import { hidesTooltips } from "./tooltip-dismiss";

describe("hidesTooltips", () => {
  it("hides the tooltips when a finger or pen touches outside every chart", () => {
    expect(hidesTooltips("touch", false)).toBe(true);
    expect(hidesTooltips("pen", false)).toBe(true);
  });

  it("shows them again on a touch on a chart", () => {
    expect(hidesTooltips("touch", true)).toBe(false);
  });

  it("never hides them for the mouse, which already closes them on leaving the chart", () => {
    expect(hidesTooltips("mouse", false)).toBe(false);
    expect(hidesTooltips("mouse", true)).toBe(false);
  });
});
