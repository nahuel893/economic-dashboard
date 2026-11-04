import { describe, expect, it } from "vitest";
import { frameAt, labelIndices, makeYScale, rectsOverlap, videoFileName } from "./series-animation";

describe("frameAt", () => {
  it("maps progress to the last reached point and how far it is towards the next", () => {
    expect(frameAt(0, 5)).toEqual({ index: 0, fraction: 0 });
    expect(frameAt(0.5, 5)).toEqual({ index: 2, fraction: 0 });
    expect(frameAt(0.625, 5)).toEqual({ index: 2, fraction: 0.5 });
    expect(frameAt(1, 5)).toEqual({ index: 4, fraction: 0 });
  });

  it("clamps progress outside 0..1", () => {
    expect(frameAt(-1, 5)).toEqual({ index: 0, fraction: 0 });
    expect(frameAt(2, 5)).toEqual({ index: 4, fraction: 0 });
  });
});

describe("labelIndices", () => {
  const dates = ["2021-11-05", "2021-12-03", "2022-01-07", "2022-06-03", "2023-01-06", "2024-01-05", "2025-01-03"];

  it("labels the first point and the first point of each year", () => {
    expect(labelIndices(dates, "year", 10)).toEqual([0, 2, 4, 5, 6]);
  });

  it("thins the labels to the maximum, always keeping the first point", () => {
    expect(labelIndices(dates, "year", 2)).toEqual([0, 2, 5]);
  });
});

describe("makeYScale", () => {
  it("maps the domain to pixels top-down, linearly or in logs", () => {
    const linear = makeYScale(0, 100, 500, 100, false);
    expect(linear(0)).toBe(500);
    expect(linear(100)).toBe(100);
    expect(linear(50)).toBe(300);

    const log = makeYScale(10, 1000, 500, 100, true);
    expect(log(100)).toBeCloseTo(300);
  });
});

describe("videoFileName", () => {
  it("names the file after the variable and the window", () => {
    expect(videoFileName("blue", { from: "2021-12", to: "2026-11" }, "mp4")).toBe("blue-2021-12-a-2026-11.mp4");
  });
});

describe("rectsOverlap", () => {
  it("is true only when two boxes share some area", () => {
    const bubble = { x: 100, y: 100, width: 200, height: 90 };
    expect(rectsOverlap(bubble, { x: 250, y: 150, width: 120, height: 30 })).toBe(true);
    expect(rectsOverlap(bubble, { x: 310, y: 150, width: 120, height: 30 })).toBe(false);
    expect(rectsOverlap(bubble, { x: 150, y: 200, width: 120, height: 30 })).toBe(false);
  });
});
