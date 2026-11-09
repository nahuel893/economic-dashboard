import { describe, expect, it } from "vitest";
import { activeSlideIndex, stepSlideIndex } from "./carousel-position";

describe("activeSlideIndex", () => {
  it("picks the slide closest to the current scroll offset", () => {
    expect(activeSlideIndex(0, 800, 5)).toBe(0);
    expect(activeSlideIndex(1600, 800, 5)).toBe(2);
    expect(activeSlideIndex(1190, 800, 5)).toBe(1);
    expect(activeSlideIndex(1210, 800, 5)).toBe(2);
  });

  it("clamps to the available slides", () => {
    expect(activeSlideIndex(-50, 800, 5)).toBe(0);
    expect(activeSlideIndex(99_999, 800, 5)).toBe(4);
  });

  it("falls back to the first slide when there is nothing to measure", () => {
    expect(activeSlideIndex(300, 0, 5)).toBe(0);
    expect(activeSlideIndex(300, 800, 0)).toBe(0);
  });
});

describe("stepSlideIndex", () => {
  it("moves with the arrow keys and jumps with Home and End", () => {
    expect(stepSlideIndex(2, "ArrowRight", 5)).toBe(3);
    expect(stepSlideIndex(2, "ArrowLeft", 5)).toBe(1);
    expect(stepSlideIndex(2, "Home", 5)).toBe(0);
    expect(stepSlideIndex(2, "End", 5)).toBe(4);
  });

  it("wraps around at both ends", () => {
    expect(stepSlideIndex(4, "ArrowRight", 5)).toBe(0);
    expect(stepSlideIndex(0, "ArrowLeft", 5)).toBe(4);
  });

  it("ignores other keys", () => {
    expect(stepSlideIndex(2, "Enter", 5)).toBeNull();
  });
});
