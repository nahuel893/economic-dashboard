/**
 * Pure helpers for the animated video of a history series: which point the
 * line has reached, which points keep a value label, and the Y scale.
 */
import { periodTicks, type MonthRange } from "./history";

/** Point the line has reached at `progress` (0..1) and how far it is towards the next one. */
export function frameAt(progress: number, length: number): { index: number; fraction: number } {
  const position = Math.min(Math.max(progress, 0), 1) * (length - 1);
  const index = Math.floor(position);
  return { index, fraction: position - index };
}

/** Points that keep a value label once the line passes them: the first one and the start of each period. */
export function labelIndices(dates: string[], period: "year" | "month", max: number): number[] {
  const starts = periodTicks(dates, period, max).map((date) => dates.indexOf(date));
  return [0, ...starts.filter((index) => index > 0)];
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

/** Maps a value to a pixel row, `bottom` for `min` and `top` for `max`. */
export function makeYScale(min: number, max: number, bottom: number, top: number, log: boolean) {
  const transform = log ? Math.log10 : (value: number) => value;
  const low = transform(min);
  const span = transform(max) - low;
  return (value: number) => bottom - (span ? (transform(value) - low) / span : 0.5) * (bottom - top);
}

export const videoFileName = (key: string, range: MonthRange, extension: string) =>
  `${key}-${range.from}-a-${range.to}.${extension}`;

export type Rect = { x: number; y: number; width: number; height: number };

/** Whether two boxes share some area (touching edges do not count). */
export const rectsOverlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
