/**
 * Chart zoom as a window over the X axis. Keys are sortable strings (plain
 * dates or YYYY-MM months), so a window works on any chart and can be shared
 * between charts with different data. Zoom is visual: the window only picks
 * which loaded points are drawn, and the axes refit to them.
 */
import { monthsIn } from "./history";

/** Inclusive window over the X axis keys. */
export type ZoomWindow = { from: string; to: string };

/** How the X axis labels a span: by day, month or year. */
export type AxisLabels = "day" | "month" | "year";

/** The window a drag selected, or null when it does not zoom: no span, a missing end, or the whole axis. */
export function selectionToWindow(a: string | undefined, b: string | undefined, keys: string[]): ZoomWindow | null {
  if (a === undefined || b === undefined || a === b) return null;
  const [from, to] = a < b ? [a, b] : [b, a];
  if (from <= keys[0] && to >= keys.at(-1)!) return null;
  return { from, to };
}

export function inWindow<T>(rows: T[], key: (row: T) => string, window: ZoomWindow | null): T[] {
  if (!window) return rows;
  return rows.filter((row) => {
    const k = key(row);
    return k >= window.from && k <= window.to;
  });
}

/** Slider positions of a window on these keys, snapped to the keys inside it. */
export function windowIndices(keys: string[], window: ZoomWindow | null): [number, number] {
  const last = keys.length - 1;
  if (!window) return [0, last];
  const start = keys.findIndex((k) => k >= window.from);
  const end = keys.findLastIndex((k) => k <= window.to);
  return [start === -1 ? last : start, end === -1 ? 0 : end];
}

/** The window between two slider positions; null when they cover the whole axis. */
export function windowFromIndices(keys: string[], start: number, end: number): ZoomWindow | null {
  const [low, high] = start <= end ? [start, end] : [end, start];
  if (low <= 0 && high >= keys.length - 1) return null;
  return { from: keys[low], to: keys[high] };
}

/** Days up to six months, months up to three years, years beyond. */
export function axisLabelsFor(first: string, last: string): AxisLabels {
  const months = monthsIn({ from: first.slice(0, 7), to: last.slice(0, 7) });
  return months <= 6 ? "day" : months <= 36 ? "month" : "year";
}
