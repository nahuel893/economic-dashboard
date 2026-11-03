import type { Point } from "./types";

/**
 * How a series is turned into changes before correlating it. Correlating levels
 * of trending series (anything nominal in pesos) yields spurious r close to 1,
 * so correlations always run on changes:
 * - "log": log change, for positive levels (prices, stocks, indexes).
 * - "diff": plain difference, for series already expressed as rates (%).
 */
export type ChangeKind = "log" | "diff";

/** Fewer common observations than this make r too unstable to show. */
export const MIN_OBSERVATIONS = 10;

const Z_95 = 1.959964;

const byDate = (a: Point, b: Point) => a.date.localeCompare(b.date);

/** Pearson correlation coefficient, or null when a sample has no variance. */
export function pearson(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;
  const meanX = x.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanY = y.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  if (varX === 0 || varY === 0) return null;
  return cov / Math.sqrt(varX * varY);
}

/** 95 % confidence interval of r via Fisher's z transformation. */
export function fisherInterval(r: number, n: number): [number, number] {
  // Clamp so atanh stays finite for |r| = 1.
  const z = Math.atanh(Math.max(-0.999999, Math.min(0.999999, r)));
  const se = 1 / Math.sqrt(n - 3);
  return [Math.tanh(z - Z_95 * se), Math.tanh(z + Z_95 * se)];
}

function change(previous: number, current: number, kind: ChangeKind): number {
  return kind === "log" ? Math.log(current / previous) : current - previous;
}

/** Changes of two series computed over the dates both of them report. */
export function alignedChanges(a: Point[], b: Point[], kind: ChangeKind): { x: number[]; y: number[] } {
  const bByDate = new Map(b.map((p) => [p.date, p.value]));
  const common = [...a].sort(byDate).filter((p) => bByDate.has(p.date));
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 1; i < common.length; i++) {
    x.push(change(common[i - 1].value, common[i].value, kind));
    y.push(change(bByDate.get(common[i - 1].date)!, bByDate.get(common[i].date)!, kind));
  }
  return { x, y };
}

export type Correlation =
  | { status: "ok"; r: number; n: number; low: number; high: number; significant: boolean }
  | { status: "insufficient"; n: number };

/** Monday to Friday, for a plain calendar date (YYYY-MM-DD). */
export function isWeekday(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6;
}

type CorrelateOptions = {
  /**
   * Drop Saturdays and Sundays. Some sources repeat Friday's quote on weekends;
   * those zero changes would inflate n and narrow the interval artificially.
   */
  weekdaysOnly?: boolean;
};

/** Correlation of the changes of two series, with its 95 % interval. */
export function correlate(a: Point[], b: Point[], kind: ChangeKind, options: CorrelateOptions = {}): Correlation {
  const keep = (points: Point[]) => (options.weekdaysOnly ? points.filter((p) => isWeekday(p.date)) : points);
  const { x, y } = alignedChanges(keep(a), keep(b), kind);
  const n = x.length;
  const r = n >= MIN_OBSERVATIONS ? pearson(x, y) : null;
  if (r === null) return { status: "insufficient", n };
  const [low, high] = fisherInterval(r, n);
  // Significant at 5 % when the interval does not include zero.
  return { status: "ok", r, n, low, high, significant: low > 0 || high < 0 };
}

/** Every point relative to the first one, which becomes 100. */
export function rebase100(points: Point[]): Point[] {
  const sorted = [...points].sort(byDate);
  const base = sorted[0]?.value;
  if (!base) return [];
  return sorted.map((p) => ({ date: p.date, value: (p.value / base) * 100 }));
}

/** Every point as its difference from the first one (for rates: change in percentage points). */
export function changeSinceStart(points: Point[]): Point[] {
  const sorted = [...points].sort(byDate);
  const base = sorted[0]?.value;
  if (base === undefined) return [];
  return sorted.map((p) => ({ date: p.date, value: p.value - base }));
}

/** Annual rate (%) implied by repeating a monthly rate (%) for twelve months. */
export function annualizeMonthly(monthlyPct: number): number {
  return (Math.pow(1 + monthlyPct / 100, 12) - 1) * 100;
}

export type MergedRow = { date: string } & Record<string, number | string>;

/** One row per date with a column per series, as charting libraries expect. */
export function mergeByDate(series: { key: string; points: Point[] }[]): MergedRow[] {
  const rows = new Map<string, MergedRow>();
  for (const { key, points } of series) {
    for (const p of points) {
      const row = rows.get(p.date) ?? { date: p.date };
      row[key] = p.value;
      rows.set(p.date, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
}
