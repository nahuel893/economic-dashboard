import { describe, expect, it } from "vitest";
import {
  downsample,
  granularityFor,
  HISTORY_FLOOR,
  inRange,
  logTicks,
  monthEnd,
  periodChange,
  periodTicks,
  resolveRange,
  shiftMonths,
} from "./history";

describe("shiftMonths", () => {
  it("moves across year boundaries in both directions", () => {
    expect(shiftMonths("2026-10", -10)).toBe("2025-12");
    expect(shiftMonths("2025-12", 1)).toBe("2026-01");
    expect(shiftMonths("2026-10", -60)).toBe("2021-10");
  });
});

describe("resolveRange", () => {
  it("defaults to the last five years ending at the latest month", () => {
    expect(resolveRange({}, "2026-10")).toEqual({ from: "2021-11", to: "2026-10" });
  });

  it("keeps a valid range from the URL", () => {
    expect(resolveRange({ desde: "2019-03", hasta: "2023-08" }, "2026-10")).toEqual({ from: "2019-03", to: "2023-08" });
  });

  it("ignores malformed months", () => {
    expect(resolveRange({ desde: "2019-13", hasta: "ayer" }, "2026-10")).toEqual({ from: "2021-11", to: "2026-10" });
  });

  it("clamps to the available history and swaps an inverted range", () => {
    expect(resolveRange({ desde: "1990-01", hasta: "2030-01" }, "2026-10")).toEqual({ from: HISTORY_FLOOR, to: "2026-10" });
    expect(resolveRange({ desde: "2024-05", hasta: "2020-02" }, "2026-10")).toEqual({ from: "2020-02", to: "2024-05" });
  });
});

describe("inRange", () => {
  it("keeps every point whose month is within the range, both ends included", () => {
    const points = ["2020-01-31", "2020-02-01", "2020-03-31", "2020-04-01"].map((date, value) => ({ date, value }));
    expect(inRange(points, { from: "2020-02", to: "2020-03" }).map((p) => p.date)).toEqual(["2020-02-01", "2020-03-31"]);
  });
});

describe("granularityFor", () => {
  it("shows daily data up to two years, weekly closes up to eight, monthly beyond", () => {
    expect(granularityFor({ from: "2024-11", to: "2026-10" })).toBe("daily");
    expect(granularityFor({ from: "2024-10", to: "2026-10" })).toBe("weekly");
    expect(granularityFor({ from: "2018-11", to: "2026-10" })).toBe("weekly");
    expect(granularityFor({ from: "2018-10", to: "2026-10" })).toBe("monthly");
  });
});

describe("downsample", () => {
  // 2026-01-05 is a Monday.
  const points = ["2026-01-05", "2026-01-09", "2026-01-12", "2026-01-30", "2026-02-02"].map((date, i) => ({
    date,
    value: i + 1,
  }));

  it("keeps every point for daily data", () => {
    expect(downsample(points, "daily")).toEqual(points);
  });

  it("keeps the last point of each week", () => {
    expect(downsample(points, "weekly").map((p) => p.date)).toEqual(["2026-01-09", "2026-01-12", "2026-01-30", "2026-02-02"]);
  });

  it("keeps the last point of each month", () => {
    expect(downsample(points, "monthly")).toEqual([
      { date: "2026-01-30", value: 4 },
      { date: "2026-02-02", value: 5 },
    ]);
  });
});

describe("logTicks", () => {
  it("places 1-2-5 steps of each power of ten inside the domain", () => {
    expect(logTicks(30, 1700)).toEqual([50, 100, 200, 500, 1000]);
  });

  it("keeps only the powers of ten when the domain spans more than two of them", () => {
    expect(logTicks(3, 1700)).toEqual([10, 100, 1000]);
  });
});

describe("periodTicks", () => {
  const dates = ["2021-11-05", "2021-12-03", "2022-01-07", "2022-06-03", "2023-01-06", "2024-01-05", "2025-01-03"];

  it("marks the first point of each year", () => {
    expect(periodTicks(dates, "year", 10)).toEqual(["2022-01-07", "2023-01-06", "2024-01-05", "2025-01-03"]);
  });

  it("marks the first point of each month, thinned to the maximum", () => {
    expect(periodTicks(dates, "month", 10)).toHaveLength(6);
    expect(periodTicks(dates, "year", 2)).toEqual(["2022-01-07", "2024-01-05"]);
  });
});

describe("periodChange", () => {
  it("is a percent change for levels and a difference in points for rates", () => {
    const points = [
      { date: "2026-01-01", value: 50 },
      { date: "2026-02-01", value: 60 },
    ];
    expect(periodChange(points, "percent")).toBeCloseTo(20);
    expect(periodChange(points, "points")).toBeCloseTo(10);
    expect(periodChange(points.slice(0, 1), "percent")).toBeNull();
  });
});

describe("monthEnd", () => {
  it("moves a monthly date to the last day of its month, leap years included", () => {
    expect(monthEnd("2023-12-01")).toBe("2023-12-31");
    expect(monthEnd("2024-02-01")).toBe("2024-02-29");
    expect(monthEnd("2026-06-30")).toBe("2026-06-30");
  });
});
