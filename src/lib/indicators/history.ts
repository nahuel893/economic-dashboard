import type { Point } from "./types";

/**
 * Earliest month offered. It leaves out the 2001-02 collapse and earlier
 * hyperinflations, whose spikes would dwarf everything after them, and keeps
 * the payload bounded (reserves alone go back to 1996).
 */
export const HISTORY_FLOOR = "2003-01";

/** Default window when the URL does not pick one. */
export const DEFAULT_YEARS = 5;

/** Inclusive range of calendar months, as YYYY-MM. */
export type MonthRange = { from: string; to: string };

export type Granularity = "daily" | "weekly" | "monthly";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const monthIndex = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;

const fromIndex = (index: number) =>
  `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;

export function shiftMonths(month: string, delta: number): string {
  return fromIndex(monthIndex(month) + delta);
}

/** Months covered by a range, both ends included. */
export const monthsIn = (range: MonthRange) => monthIndex(range.to) - monthIndex(range.from) + 1;

const clamp = (month: string, latest: string) =>
  month < HISTORY_FLOOR ? HISTORY_FLOOR : month > latest ? latest : month;

/** The range asked for in the URL, made valid: well formed, ordered and within the available history. */
export function resolveRange(params: { desde?: string; hasta?: string }, latest: string): MonthRange {
  const valid = (value?: string) => (value && MONTH.test(value) ? value : undefined);
  const to = clamp(valid(params.hasta) ?? latest, latest);
  const from = clamp(valid(params.desde) ?? shiftMonths(to, -(DEFAULT_YEARS * 12 - 1)), latest);
  return from <= to ? { from, to } : { from: to, to: from };
}

export function inRange(points: Point[], range: MonthRange): Point[] {
  return points.filter((p) => {
    const month = p.date.slice(0, 7);
    return month >= range.from && month <= range.to;
  });
}

/** Daily data up to two years, weekly closes up to eight, monthly closes beyond: a few hundred points at most. */
export function granularityFor(range: MonthRange): Granularity {
  const months = monthsIn(range);
  return months <= 24 ? "daily" : months <= 96 ? "weekly" : "monthly";
}

/** Monday of the week a plain date (YYYY-MM-DD) falls in. */
function weekOf(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

/** Keeps the last point of each period: the closing value, as markets report it. */
export function downsample(points: Point[], granularity: Granularity): Point[] {
  if (granularity === "daily") return points;
  const bucket = granularity === "weekly" ? weekOf : (date: string) => date.slice(0, 7);
  const last = new Map<string, Point>();
  for (const p of [...points].sort((a, b) => a.date.localeCompare(b.date))) last.set(bucket(p.date), p);
  return [...last.values()];
}

/**
 * Ticks for a log axis within [min, max]: 1, 2 and 5 times each power of ten,
 * or only the powers of ten when the domain spans more than two of them.
 */
export function logTicks(min: number, max: number): number[] {
  const ticks: number[] = [];
  const steps = Math.log10(max / min) > 2 ? [1] : [1, 2, 5];
  for (let power = Math.floor(Math.log10(min)); power <= Math.ceil(Math.log10(max)); power++) {
    for (const step of steps) {
      const tick = step * 10 ** power;
      if (tick >= min && tick <= max) ticks.push(tick);
    }
  }
  return ticks;
}

/** Round tick values (1, 2 or 5 times a power of ten apart) within [min, max]. */
export function linearTicks(min: number, max: number, count: number): number[] {
  if (!(max > min)) return [min];
  const rough = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const step = (normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10) * magnitude;
  const ticks: number[] = [];
  for (let k = Math.ceil(min / step); k * step <= max; k++) ticks.push(Number((k * step).toPrecision(12)) + 0);
  return ticks;
}

/**
 * Axis ticks at the first point of each year or month (the first period is
 * skipped: the window may start mid-way through it), keeping every n-th one so
 * there are at most `max`.
 */
export function periodTicks(dates: string[], period: "year" | "month", max: number): string[] {
  const length = period === "year" ? 4 : 7;
  const starts = dates.filter((date, i) => i > 0 && date.slice(0, length) !== dates[i - 1].slice(0, length));
  const step = Math.ceil(starts.length / max);
  return starts.filter((_, i) => i % step === 0);
}

/** Change from the first to the last point: % for levels, difference for rates. Null with fewer than two points. */
export function periodChange(points: Point[], kind: "percent" | "points"): number | null {
  if (points.length < 2) return null;
  const first = points[0].value;
  const last = points.at(-1)!.value;
  if (kind === "points") return last - first;
  return first === 0 ? null : (last / first - 1) * 100;
}

/**
 * Last day of the month of a plain date. Monthly series are dated at the start
 * of the month by some sources and at the end by others; using the end for all
 * keeps them aligned with each other and with marks that start mid-month.
 */
export function monthEnd(date: string): string {
  const [year, month] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}
