import { describe, expect, it } from "vitest";
import {
  bandPosition,
  changeOverMonths,
  gapHistory,
  lastN,
  percentGap,
  realRate,
  tnaToTea,
  toBuenosAiresDate,
  toSeries,
  valueBefore,
} from "./calc";

describe("percentGap", () => {
  it("returns how much higher a is than b, in percent", () => {
    expect(percentGap(1650, 1500)).toBeCloseTo(10);
  });

  it("returns a negative gap when a is below b", () => {
    expect(percentGap(1350, 1500)).toBeCloseTo(-10);
  });
});

describe("bandPosition", () => {
  it("locates the value inside the band and its distance to the ceiling", () => {
    const result = bandPosition(1500, 1000, 2000);
    expect(result.positionPct).toBeCloseTo(50);
    expect(result.toCeilingPct).toBeCloseTo(33.333, 2);
  });

  it("reports a position above 100 when the value breaks the ceiling", () => {
    expect(bandPosition(2100, 1000, 2000).positionPct).toBeCloseTo(110);
  });
});

describe("gapHistory", () => {
  it("computes the gap only for dates present in both series", () => {
    const ccl = [
      { date: "2026-10-28", value: 1650 },
      { date: "2026-10-29", value: 1660 },
      { date: "2026-10-30", value: 1640 },
    ];
    const official = [
      { date: "2026-10-29", value: 1500 },
      { date: "2026-10-30", value: 1600 },
    ];

    const result = gapHistory(ccl, official);

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe("2026-10-29");
    expect(result[0].value).toBeCloseTo(10.667, 2);
    expect(result[1].date).toBe("2026-10-30");
    expect(result[1].value).toBeCloseTo(2.5);
  });
});

describe("valueBefore", () => {
  const points = [
    { date: "2026-10-28", value: 1 },
    { date: "2026-10-29", value: 2 },
    { date: "2026-10-30", value: 3 },
  ];

  it("returns the latest value strictly before the given date", () => {
    expect(valueBefore(points, "2026-10-30")).toBe(2);
  });

  it("returns null when no earlier point exists", () => {
    expect(valueBefore(points, "2026-10-28")).toBeNull();
  });
});

describe("toBuenosAiresDate", () => {
  it("converts a UTC timestamp to the Buenos Aires calendar day", () => {
    expect(toBuenosAiresDate("2026-10-31T01:30:00.000Z")).toBe("2026-10-30");
    expect(toBuenosAiresDate("2026-10-30T20:57:00.000Z")).toBe("2026-10-30");
  });
});

describe("tnaToTea", () => {
  it("compounds a nominal annual rate placed at 30 days", () => {
    // 22,39 % TNA at 30 days -> (1 + 0.2239 * 30/365) ^ (365/30) - 1
    expect(tnaToTea(22.39)).toBeCloseTo(24.84, 1);
  });
});

describe("realRate", () => {
  it("deflates an effective rate by expected inflation", () => {
    // (1.2484 / 1.211) - 1
    expect(realRate(24.84, 21.1)).toBeCloseTo(3.09, 1);
  });

  it("is negative when inflation beats the rate", () => {
    expect(realRate(20, 30)).toBeLessThan(0);
  });
});

describe("toSeries", () => {
  it("summarizes the latest value, the one before and the trailing history", () => {
    const points = [
      { date: "2026-10-30", value: 3 },
      { date: "2026-10-28", value: 1 },
      { date: "2026-10-29", value: 2 },
    ];
    expect(toSeries(points, 2)).toEqual({
      value: 3,
      date: "2026-10-30",
      previous: 2,
      history: [
        { date: "2026-10-29", value: 2 },
        { date: "2026-10-30", value: 3 },
      ],
    });
  });

  it("throws on an empty series", () => {
    expect(() => toSeries([], 10)).toThrow();
  });
});

describe("lastN", () => {
  it("keeps the most recent n points sorted by date", () => {
    const points = [
      { date: "2026-10-30", value: 3 },
      { date: "2026-10-28", value: 1 },
      { date: "2026-10-29", value: 2 },
    ];
    expect(lastN(points, 2)).toEqual([
      { date: "2026-10-29", value: 2 },
      { date: "2026-10-30", value: 3 },
    ]);
  });
});

describe("changeOverMonths", () => {
  const points = [
    { date: "2025-01-01", value: 100 },
    { date: "2025-02-01", value: 102 },
    { date: "2026-01-01", value: 105 },
    { date: "2026-02-01", value: 99.96 },
  ];

  it("is the percent change against the same month one year earlier", () => {
    const yoy = changeOverMonths(points, 12);
    expect(yoy.map((p) => p.date)).toEqual(["2026-01-01", "2026-02-01"]);
    expect(yoy[0].value).toBeCloseTo(5);
    expect(yoy[1].value).toBeCloseTo(-2);
  });

  it("only compares with the month exactly that far back", () => {
    const mom = changeOverMonths(points, 1);
    expect(mom).toHaveLength(2);
    expect(mom[0]).toMatchObject({ date: "2025-02-01" });
    expect(mom[0].value).toBeCloseTo(2);
    expect(mom[1].value).toBeCloseTo(-4.8);
  });
});
