import { describe, expect, it } from "vitest";
import type { HistoryGroup, HistorySnapshot, HistoryVariable } from "./history-data";
import { buildPanel, chartKind, mergeByMonth, PANEL_CHARTS, PANEL_KPIS } from "./panel";
import type { Indicator, Point } from "./types";

const ok = (points: Point[]): Indicator<Point[]> => ({ status: "ok", source: "ArgentinaDatos", data: points });

function variable(key: string, indicator: Indicator<Point[]>): HistoryVariable {
  return { key, label: key, description: `${key} description`, unit: "ars2", frequency: "daily", change: "percent", logScale: false, indicator };
}

const KEYS = [...new Set([...PANEL_KPIS, ...PANEL_CHARTS.flatMap((chart) => chart.series)])];

function snapshot(overrides: Record<string, Indicator<Point[]>> = {}): HistorySnapshot {
  const base = ok([
    { date: "2025-12-30", value: 90 },
    { date: "2026-01-05", value: 100 },
    { date: "2026-01-30", value: 110 },
    { date: "2026-02-27", value: 121 },
  ]);
  const group: HistoryGroup = {
    id: "dollars",
    title: "All",
    description: "",
    variables: KEYS.map((key) => variable(key, overrides[key] ?? base)),
  };
  return { groups: [group], latestMonth: "2026-02" };
}

const range = { from: "2026-01", to: "2026-02" };

describe("buildPanel", () => {
  it("keeps the close of each month within the range, keyed by month", () => {
    const { variables } = buildPanel(snapshot(), range);
    expect(variables.blue.points).toEqual([
      { month: "2026-01", value: 110 },
      { month: "2026-02", value: 121 },
    ]);
  });

  it("reports the latest value and the change over the whole period, from every point in it", () => {
    const blue = buildPanel(snapshot(), range).variables.blue;
    expect(blue.last).toEqual({ date: "2026-02-27", value: 121 });
    expect(blue.periodChange).toBeCloseTo(21);
  });

  it("measures rates in points", () => {
    const snap = snapshot({ gap: ok([{ date: "2026-01-02", value: 30 }, { date: "2026-02-02", value: 25 }]) });
    snap.groups[0].variables = snap.groups[0].variables.map((v) => (v.key === "gap" ? { ...v, change: "points" } : v));
    expect(buildPanel(snap, range).variables.gap.periodChange).toBe(-5);
  });

  it("keeps a failed source as an error with its message and no points", () => {
    const { variables } = buildPanel(
      snapshot({ reserves: { status: "error", source: "BCRA", message: "BCRA responded 503" } }),
      range,
    );
    expect(variables.reserves).toMatchObject({ status: "error", message: "BCRA responded 503", points: [], last: null });
  });

  it("has a variable for every KPI and every chart series", () => {
    const { variables } = buildPanel(snapshot(), range);
    for (const key of KEYS) expect(variables[key]).toBeDefined();
  });
});

describe("mergeByMonth", () => {
  it("puts several series on one row per month, leaving missing months empty", () => {
    expect(
      mergeByMonth([
        { key: "a", points: [{ month: "2026-01", value: 1 }, { month: "2026-02", value: 2 }] },
        { key: "b", points: [{ month: "2026-02", value: 20 }] },
      ]),
    ).toEqual([
      { month: "2026-01", a: 1 },
      { month: "2026-02", a: 2, b: 20 },
    ]);
  });
});

describe("chartKind", () => {
  it("draws monthly changes as columns and everything else as lines", () => {
    expect(chartKind(["monthlyInflation"])).toBe("bar");
    expect(chartKind(["activityYearly"])).toBe("bar");
    expect(chartKind(["blue"])).toBe("line");
    expect(chartKind(["badlar", "yearlyInflation"])).toBe("line");
  });
});
