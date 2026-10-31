import type { Point } from "./types";

/** How much higher `a` is than `b`, in percent. */
export function percentGap(a: number, b: number): number {
  return (a / b - 1) * 100;
}

/**
 * Position of `value` inside the [lower, upper] band (0 = floor, 100 = ceiling)
 * and how far it is from reaching the ceiling, in percent.
 */
export function bandPosition(value: number, lower: number, upper: number) {
  return {
    positionPct: ((value - lower) / (upper - lower)) * 100,
    toCeilingPct: percentGap(upper, value),
  };
}

/** Gap between two series, only for dates present in both. */
export function gapHistory(series: Point[], base: Point[]): Point[] {
  const baseByDate = new Map(base.map((p) => [p.date, p.value]));
  return series
    .filter((p) => baseByDate.has(p.date))
    .map((p) => ({ date: p.date, value: percentGap(p.value, baseByDate.get(p.date)!) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The latest value dated strictly before `date`, or null if there is none. */
export function valueBefore(points: Point[], date: string): number | null {
  const earlier = points.filter((p) => p.date < date);
  return earlier.length ? lastN(earlier, 1)[0].value : null;
}

/** Calendar day (YYYY-MM-DD) of a timestamp in Buenos Aires time. */
export function toBuenosAiresDate(timestamp: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(
    new Date(timestamp),
  );
}

/** Effective annual rate (%) of a nominal annual rate (%) renewed every `termDays`. */
export function tnaToTea(tnaPct: number, termDays = 30): number {
  const periodRate = (tnaPct / 100) * (termDays / 365);
  return (Math.pow(1 + periodRate, 365 / termDays) - 1) * 100;
}

/** Real return (%) of an effective rate once deflated by inflation over the same period. */
export function realRate(effectivePct: number, inflationPct: number): number {
  return ((1 + effectivePct / 100) / (1 + inflationPct / 100) - 1) * 100;
}

export type Series = { value: number; date: string; previous: number | null; history: Point[] };

/** Latest value, the one before it and the trailing `n` points of a series. */
export function toSeries(points: Point[], n: number): Series {
  const history = lastN(points, n);
  const latest = history.at(-1);
  if (!latest) throw new Error("Series is empty");
  return { value: latest.value, date: latest.date, previous: history.at(-2)?.value ?? null, history };
}

/** The most recent `n` points, in ascending date order. */
export function lastN(points: Point[], n: number): Point[] {
  return [...points].sort((a, b) => a.date.localeCompare(b.date)).slice(-n);
}
