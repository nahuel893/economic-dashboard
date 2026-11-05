import { describe, expect, it } from "vitest";
import { axisLabelsFor, inWindow, selectionToWindow, windowFromIndices, windowIndices } from "./zoom";

const keys = ["2024-01", "2024-02", "2024-03", "2024-04", "2024-05"];

describe("selectionToWindow", () => {
  it("turns a drag into a window, whichever way it went", () => {
    expect(selectionToWindow("2024-02", "2024-04", keys)).toEqual({ from: "2024-02", to: "2024-04" });
    expect(selectionToWindow("2024-04", "2024-02", keys)).toEqual({ from: "2024-02", to: "2024-04" });
  });

  it("ignores a click without a span and a drag without both ends", () => {
    expect(selectionToWindow("2024-03", "2024-03", keys)).toBeNull();
    expect(selectionToWindow(undefined, "2024-03", keys)).toBeNull();
  });

  it("ignores a drag over the whole axis: that is no zoom", () => {
    expect(selectionToWindow("2024-01", "2024-05", keys)).toBeNull();
  });
});

describe("inWindow", () => {
  const rows = keys.map((month, i) => ({ month, value: i }));

  it("keeps the rows inside the window, ends included", () => {
    expect(inWindow(rows, (r) => r.month, { from: "2024-02", to: "2024-03" }).map((r) => r.value)).toEqual([1, 2]);
  });

  it("keeps every row without a window", () => {
    expect(inWindow(rows, (r) => r.month, null)).toBe(rows);
  });
});

describe("slider positions", () => {
  it("maps a window to slider indices and back", () => {
    expect(windowIndices(keys, { from: "2024-02", to: "2024-04" })).toEqual([1, 3]);
    expect(windowFromIndices(keys, 1, 3)).toEqual({ from: "2024-02", to: "2024-04" });
  });

  it("covers the whole axis without a window, and clears the window when the slider covers it", () => {
    expect(windowIndices(keys, null)).toEqual([0, 4]);
    expect(windowFromIndices(keys, 0, 4)).toBeNull();
  });

  it("snaps a window to the keys a chart has", () => {
    // Monthly keys against a window taken from another chart's dates.
    expect(windowIndices(keys, { from: "2024-01-15", to: "2024-03-31" })).toEqual([1, 2]);
  });
});

describe("axisLabelsFor", () => {
  it("labels days on short spans, months on medium ones and years on long ones", () => {
    expect(axisLabelsFor("2024-01-05", "2024-05-30")).toBe("day");
    expect(axisLabelsFor("2023-01-05", "2025-06-30")).toBe("month");
    expect(axisLabelsFor("2015-01-05", "2025-06-30")).toBe("year");
  });
});
