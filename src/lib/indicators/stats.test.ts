import { describe, expect, it } from "vitest";
import {
  alignedChanges,
  annualizeMonthly,
  changeSinceStart,
  correlate,
  fisherInterval,
  mergeByDate,
  pearson,
  rebase100,
} from "./stats";

const series = (values: number[], start = 1) =>
  values.map((value, i) => ({ date: `2026-01-${String(start + i).padStart(2, "0")}`, value }));

describe("pearson", () => {
  it("is 1 for perfectly correlated samples and -1 for opposite ones", () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(pearson([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1);
  });

  it("matches a known textbook value", () => {
    expect(pearson([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])).toBeCloseTo(0.7746, 4);
  });

  it("is null when one sample has no variance", () => {
    expect(pearson([1, 2, 3], [5, 5, 5])).toBeNull();
  });
});

describe("fisherInterval", () => {
  it("gives the 95 % confidence interval of r", () => {
    const [low, high] = fisherInterval(0.5, 30);
    expect(low).toBeCloseTo(0.17, 2);
    expect(high).toBeCloseTo(0.729, 2);
  });
});

describe("alignedChanges", () => {
  it("computes log changes only over dates present in both series", () => {
    const a = series([100, 110, 121, 133.1]); // days 1..4
    const b = [
      { date: "2026-01-01", value: 10 },
      { date: "2026-01-02", value: 20 },
      { date: "2026-01-04", value: 40 },
    ];

    const { x, y } = alignedChanges(a, b, "log");

    // Common dates: 01, 02, 04 -> two changes.
    expect(x).toHaveLength(2);
    expect(x[0]).toBeCloseTo(Math.log(1.1));
    expect(x[1]).toBeCloseTo(Math.log(133.1 / 110));
    expect(y[0]).toBeCloseTo(Math.log(2));
    expect(y[1]).toBeCloseTo(Math.log(2));
  });

  it("uses plain differences for rates", () => {
    const { x } = alignedChanges(series([20, 21.5, 21]), series([1, 1, 1]), "diff");
    expect(x[0]).toBeCloseTo(1.5);
    expect(x[1]).toBeCloseTo(-0.5);
  });
});

describe("correlate", () => {
  it("reports r, sample size, interval and significance", () => {
    const a = series(Array.from({ length: 25 }, (_, i) => 100 * Math.exp(0.01 * Math.sin(i))));
    const b = series(Array.from({ length: 25 }, (_, i) => 50 * Math.exp(0.02 * Math.sin(i))));

    const result = correlate(a, b, "log");

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.r).toBeCloseTo(1);
    expect(result.n).toBe(24);
    expect(result.significant).toBe(true);
  });

  it("drops weekends so carried-forward quotes do not inflate n", () => {
    // 2026-01-01 is a Thursday: 28 calendar days hold 20 weekdays -> 19 changes.
    const values = Array.from({ length: 28 }, (_, i) => 100 * Math.exp(0.01 * Math.sin(i)));
    const a = series(values);
    const b = series(values.map((v) => v * 2));

    const all = correlate(a, b, "log");
    const weekdays = correlate(a, b, "log", { weekdaysOnly: true });

    expect(all.n).toBe(27);
    expect(weekdays.n).toBe(19);
  });

  it("refuses to estimate with too few common observations", () => {
    expect(correlate(series([1, 2, 3, 4]), series([4, 3, 2, 1]), "log").status).toBe("insufficient");
  });
});

describe("rebase100", () => {
  it("expresses every point relative to the first one", () => {
    const rebased = rebase100(series([50, 55, 45]));
    expect(rebased.map((p) => p.date)).toEqual(series([0, 0, 0]).map((p) => p.date));
    [100, 110, 90].forEach((expected, i) => expect(rebased[i].value).toBeCloseTo(expected));
  });
});

describe("changeSinceStart", () => {
  it("expresses every point as its difference from the first one", () => {
    const changed = changeSinceStart(series([22, 23.5, 21]));
    [0, 1.5, -1].forEach((expected, i) => expect(changed[i].value).toBeCloseTo(expected));
  });
});

describe("annualizeMonthly", () => {
  it("compounds a monthly rate over twelve months", () => {
    expect(annualizeMonthly(1.9)).toBeCloseTo(25.34, 1);
  });
});

describe("mergeByDate", () => {
  it("builds one row per date with a column per series", () => {
    const rows = mergeByDate([
      { key: "a", points: series([1, 2]) },
      { key: "b", points: series([3], 2) },
    ]);
    expect(rows).toEqual([
      { date: "2026-01-01", a: 1 },
      { date: "2026-01-02", a: 2, b: 3 },
    ]);
  });
});
